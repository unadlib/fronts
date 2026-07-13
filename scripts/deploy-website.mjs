import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process, { stdout } from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const repositoryRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(repositoryRoot, 'website/out');
const supportedArguments = new Set(['--dry-run', '--skip-check', '--skip-online-verification']);
const argumentsSet = new Set(process.argv.slice(2).filter((argument) => argument !== '--'));

for (const argument of argumentsSet) {
  if (!supportedArguments.has(argument)) throw new Error(`Unknown argument: ${argument}`);
}

const dryRun = argumentsSet.has('--dry-run');
const skipCheck = argumentsSet.has('--skip-check');
const skipOnlineVerification = argumentsSet.has('--skip-online-verification');

function git(arguments_, options = {}) {
  return execFileSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  }).trim();
}

function run(command, arguments_, options = {}) {
  stdout.write(`> ${command} ${arguments_.join(' ')}\n`);
  execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    stdio: 'inherit',
    ...options,
  });
}

function optionalGitConfig(key, fallback) {
  const result = spawnSync('git', ['config', '--get', key], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim() !== '' ? result.stdout.trim() : fallback;
}

async function verifyOnline(hostname, revision) {
  const deadline = Date.now() + 5 * 60_000;
  const url = `https://${hostname}/en/docs/?revision=${encodeURIComponent(revision)}`;
  let lastObservation = 'no response';

  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(url, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
        redirect: 'follow',
      });
      const body = await response.text();
      if (response.ok && body.includes('fronts-revision') && body.includes(revision)) {
        stdout.write(`Verified deployed revision ${revision} at ${url}\n`);
        return;
      }
      lastObservation = `HTTP ${response.status}; revision metadata did not match`;
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : String(error);
    }

    stdout.write(`Waiting for GitHub Pages: ${lastObservation}\n`);
    await delay(10_000);
  }

  throw new Error(`GitHub Pages did not expose revision ${revision}: ${lastObservation}`);
}

const branchResult = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
const branch =
  branchResult.status === 0 ? branchResult.stdout.trim() : (process.env.GITHUB_REF_NAME ?? '');
if (branch !== 'main')
  throw new Error(`Website deployment must run from main, not ${branch || 'detached HEAD'}.`);

const dirty = git(['status', '--porcelain=v1', '--untracked-files=all']);
if (dirty !== '')
  throw new Error('Website deployment requires a clean worktree. Commit or stash changes first.');

run('git', [
  'fetch',
  '--no-tags',
  'origin',
  '+refs/heads/main:refs/remotes/origin/main',
  '+refs/heads/gh-pages:refs/remotes/origin/gh-pages',
]);

const sourceRevision = git(['rev-parse', 'HEAD']);
const remoteMain = git(['rev-parse', 'origin/main']);
if (sourceRevision !== remoteMain) {
  throw new Error(
    `HEAD ${sourceRevision} is not the current origin/main ${remoteMain}. Push main first.`,
  );
}

const remotePagesLine = git(['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']);
const [previousPagesRevision] = remotePagesLine.split(/\s+/);
if (!/^[0-9a-f]{40}$/.test(previousPagesRevision ?? '')) {
  throw new Error('origin/gh-pages is missing; an existing CNAME cannot be preserved.');
}

const existingCname = execFileSync('git', ['show', `${previousPagesRevision}:CNAME`], {
  cwd: repositoryRoot,
  encoding: 'buffer',
});
const hostname = existingCname.toString('utf8').trim();
if (hostname === '' || /[\r\n]/.test(hostname)) {
  throw new Error('The existing gh-pages CNAME must contain exactly one hostname.');
}

if (!skipCheck) run('pnpm', ['website:check']);
if (!existsSync(join(outputRoot, 'index.html'))) {
  throw new Error('website/out is missing a static export; run pnpm website:check first.');
}
const exportedDocumentation = readFileSync(join(outputRoot, 'en/docs/index.html'), 'utf8');
if (
  !exportedDocumentation.includes('fronts-revision') ||
  !exportedDocumentation.includes(sourceRevision)
) {
  throw new Error(
    `website/out does not contain source revision ${sourceRevision}; rebuild before deployment.`,
  );
}
const dirtyAfterCheck = git(['status', '--porcelain=v1', '--untracked-files=all']);
if (dirtyAfterCheck !== '') {
  throw new Error(
    'Website verification changed tracked files; review and commit them before deployment.',
  );
}

const stagingRoot = mkdtempSync(join(tmpdir(), 'fronts-pages-'));
const temporaryIndex = `${stagingRoot}.index`;

try {
  for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
    cpSync(join(outputRoot, entry.name), join(stagingRoot, entry.name), { recursive: true });
  }
  writeFileSync(join(stagingRoot, 'CNAME'), existingCname);
  writeFileSync(join(stagingRoot, '.nojekyll'), '');

  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_EMAIL: optionalGitConfig(
      'user.email',
      'github-actions[bot]@users.noreply.github.com',
    ),
    GIT_AUTHOR_NAME: optionalGitConfig('user.name', 'github-actions[bot]'),
    GIT_COMMITTER_EMAIL: optionalGitConfig(
      'user.email',
      'github-actions[bot]@users.noreply.github.com',
    ),
    GIT_COMMITTER_NAME: optionalGitConfig('user.name', 'github-actions[bot]'),
    GIT_INDEX_FILE: temporaryIndex,
    GIT_WORK_TREE: stagingRoot,
  };

  execFileSync('git', ['read-tree', '--empty'], { cwd: repositoryRoot, env: gitEnvironment });
  execFileSync('git', ['add', '--all'], { cwd: repositoryRoot, env: gitEnvironment });
  const tree = git(['write-tree'], { env: gitEnvironment });
  const deploymentRevision = git(['commit-tree', tree], {
    env: gitEnvironment,
    input: `docs: deploy ${sourceRevision.slice(0, 12)}\n`,
  });

  const commit = git(['cat-file', '-p', deploymentRevision]);
  if (/^parent /m.test(commit)) throw new Error('Deployment commit unexpectedly has a parent.');

  const deployedCname = execFileSync('git', ['show', `${deploymentRevision}:CNAME`], {
    cwd: repositoryRoot,
    encoding: 'buffer',
  });
  if (!deployedCname.equals(existingCname)) {
    throw new Error('The deployment commit did not preserve CNAME byte-for-byte.');
  }

  const paths = git(['ls-tree', '-r', '--name-only', deploymentRevision]).split('\n');
  for (const requiredPath of ['.nojekyll', 'CNAME', 'index.html']) {
    if (!paths.includes(requiredPath))
      throw new Error(`Deployment tree is missing ${requiredPath}.`);
  }
  for (const retiredPath of [
    'assets/css/styles.',
    'assets/js/runtime~main.',
    'docusaurus.config.js',
  ]) {
    if (paths.some((path) => path.startsWith(retiredPath))) {
      throw new Error(`Deployment tree retained an old Docusaurus path: ${retiredPath}`);
    }
  }

  stdout.write(
    `Prepared root deployment commit ${deploymentRevision} with ${paths.length} files; preserved CNAME ${JSON.stringify(hostname)}.\n`,
  );

  if (dryRun) {
    stdout.write('Dry run complete; gh-pages was not changed.\n');
  } else {
    run('git', [
      'push',
      `--force-with-lease=refs/heads/gh-pages:${previousPagesRevision}`,
      'origin',
      `${deploymentRevision}:refs/heads/gh-pages`,
    ]);

    const publishedPagesLine = git(['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']);
    const [publishedPagesRevision] = publishedPagesLine.split(/\s+/);
    if (publishedPagesRevision !== deploymentRevision) {
      throw new Error(
        `origin/gh-pages points to ${publishedPagesRevision}, expected ${deploymentRevision}.`,
      );
    }

    if (!skipOnlineVerification) await verifyOnline(hostname, sourceRevision);
  }
} finally {
  rmSync(stagingRoot, { force: true, recursive: true });
  rmSync(temporaryIndex, { force: true });
}
