import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process, { stderr, stdout } from 'node:process';

/**
 * Verifies the adapters against the lowest framework versions their peer ranges declare.
 *
 * The regular suite installs one workspace version of React and Vue, so a declared minimum is a
 * promise no gate keeps. The minimum is derived from the published peer range rather than repeated
 * here, so widening or narrowing a range moves this job with it instead of leaving it stale.
 */

const root = resolve(import.meta.dirname, '..');
const rootManifestPath = join(root, 'package.json');

/** Peer dependencies whose lower bound is a support claim, and the workspace that declares them. */
const claims = [
  { owner: 'packages/react', peer: 'react' },
  { owner: 'packages/react', peer: 'react-dom' },
  { owner: 'packages/vue3', peer: 'vue' },
];

const suites = ['packages/react/test', 'packages/vue3/test'];

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Reads the inclusive lower bound of a peer range such as `>=18.2.0 <20`. */
function lowerBound(range, peer, owner) {
  const match = /^>=\s*(\d+\.\d+\.\d+)/.exec(range);
  if (match === null) {
    stderr.write(
      `${owner} declares "${peer}": "${range}", which has no inclusive lower bound to verify.\n`,
    );
    process.exit(1);
  }
  return match[1];
}

const overrides = {};
for (const { owner, peer } of claims) {
  const manifest = readManifest(join(root, owner, 'package.json'));
  const range = manifest.peerDependencies?.[peer];
  if (typeof range !== 'string') {
    stderr.write(`${owner} no longer declares a "${peer}" peer dependency.\n`);
    process.exit(1);
  }
  overrides[peer] = lowerBound(range, peer, owner);
}

stdout.write(`Verifying declared framework minimums: ${JSON.stringify(overrides)}\n`);

// The adapter suites reach @fronts/core through its package exports, which resolve to dist. Build
// with the committed dependency set first, so a clean checkout verifies what a warm one does and the
// only variable left in the run below is the framework version.
run('pnpm', ['build']);

const originalManifest = readFileSync(rootManifestPath, 'utf8');
const manifest = JSON.parse(originalManifest);
manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, ...overrides } };
writeFileSync(rootManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

let failure;
let restoreFailure;
try {
  run('pnpm', ['install', '--no-frozen-lockfile']);
  run('pnpm', ['exec', 'vitest', 'run', ...suites]);
} catch (error) {
  failure = error;
} finally {
  // The override install rewrites the lockfile, so restore both tracked files before exiting.
  // A restore failure is reported alongside the run result rather than replacing it.
  writeFileSync(rootManifestPath, originalManifest);
  try {
    run('git', ['checkout', '--', 'pnpm-lock.yaml']);
    run('pnpm', ['install', '--frozen-lockfile']);
  } catch (error) {
    restoreFailure = error;
  }
}

if (failure !== undefined) {
  stderr.write('The adapters do not pass against their declared minimum framework versions.\n');
}
if (restoreFailure !== undefined) {
  stderr.write('Failed to restore package.json and pnpm-lock.yaml after the run.\n');
}
if (failure !== undefined || restoreFailure !== undefined) {
  process.exit(1);
}

stdout.write('Adapters pass against their declared minimum framework versions.\n');
