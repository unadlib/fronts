import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';

const root = resolve(import.meta.dirname, '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'fronts-packages-'));
const archiveDirectory = join(temporaryDirectory, 'archives');
const consumerDirectory = join(temporaryDirectory, 'consumer');

const packages = [
  { directory: 'packages/core', name: '@fronts/core' },
  { directory: 'packages/mf', name: '@fronts/mf' },
  { directory: 'packages/react', name: '@fronts/react' },
  { directory: 'packages/vue3', name: '@fronts/vue3' },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function createSmokePrograms() {
  writeFileSync(
    join(consumerDirectory, 'esm-smoke.mjs'),
    `import assert from 'node:assert/strict';

const core = await import('@fronts/core');
const iframe = await import('@fronts/core/iframe');
const mf = await import('@fronts/mf');
const react = await import('@fronts/react');
const vue = await import('@fronts/vue3');

assert.equal(typeof core.createFrontsHost, 'function');
assert.equal(typeof iframe.createIframeAgent, 'function');
assert.equal(typeof mf.createModuleFederationAdapter, 'function');
assert.equal(typeof mf.createMfHost, 'function');
assert.equal(typeof react.defineReactApp, 'function');
assert.equal(typeof react.createReactBindings, 'function');
assert.equal(typeof vue.defineVueApp, 'function');
assert.equal(typeof vue.createVueBindings, 'function');
assert.equal(core.normalizeAppRef({ name: 'smoke' }).expose, './application');

const app = core.defineApp({ mount: () => ({ unmount() {} }) });
assert.equal(core.isFrontsApp(app), true);
`,
  );

  writeFileSync(
    join(consumerDirectory, 'cjs-smoke.cjs'),
    `const assert = require('node:assert/strict');

const core = require('@fronts/core');
const iframe = require('@fronts/core/iframe');
const mf = require('@fronts/mf');
const react = require('@fronts/react');
const vue = require('@fronts/vue3');

assert.equal(typeof core.createFrontsHost, 'function');
assert.equal(typeof iframe.createIframeAgent, 'function');
assert.equal(typeof mf.createModuleFederationAdapter, 'function');
assert.equal(typeof mf.createMfHost, 'function');
assert.equal(typeof react.defineReactApp, 'function');
assert.equal(typeof react.createReactBindings, 'function');
assert.equal(typeof vue.defineVueApp, 'function');
assert.equal(typeof vue.createVueBindings, 'function');
`,
  );

  writeFileSync(
    join(consumerDirectory, 'esm-types.ts'),
    `import type { HostComposition } from '@fronts/core';
import { createMfHost, type ModuleFederationSource } from '@fronts/mf';
import { createReactBindings } from '@fronts/react';
import { createVueBindings } from '@fronts/vue3';

interface Contracts {
  readonly checkout: { readonly cartId: string };
}

declare const composition: HostComposition<Contracts, ModuleFederationSource, object>;

const react = createReactBindings(composition);
const vue = createVueBindings(composition);

void createMfHost;
void react.App;
void vue.App;
`,
  );

  writeFileSync(
    join(consumerDirectory, 'cjs-types.cts'),
    `import core = require('@fronts/core');
import mf = require('@fronts/mf');
import reactPackage = require('@fronts/react');
import vuePackage = require('@fronts/vue3');

interface Contracts {
  readonly checkout: { readonly cartId: string };
}

declare const composition: core.HostComposition<Contracts, mf.ModuleFederationSource, object>;

const react = reactPackage.createReactBindings(composition);
const vue = vuePackage.createVueBindings(composition);

void mf.createMfHost;
void react.App;
void vue.App;
`,
  );

  writeFileSync(
    join(consumerDirectory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          exactOptionalPropertyTypes: true,
          lib: ['ES2023', 'DOM', 'DOM.Iterable'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: 'ES2022',
          verbatimModuleSyntax: true,
        },
        files: ['esm-types.ts', 'cjs-types.cts'],
      },
      null,
      2,
    )}\n`,
  );
}

mkdirSync(archiveDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

try {
  const archives = new Map();

  for (const candidate of packages) {
    const previousFiles = new Set(readdirSync(archiveDirectory));
    run('pnpm', ['--filter', candidate.name, 'pack', '--pack-destination', archiveDirectory]);
    const created = readdirSync(archiveDirectory).filter((file) => !previousFiles.has(file));
    assert.equal(created.length, 1, `Expected one tarball for ${candidate.name}`);

    const archive = join(archiveDirectory, created[0]);
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
    for (const required of ['package/package.json', 'package/README.md', 'package/LICENSE']) {
      assert(entries.includes(required), `${candidate.name} is missing ${required}`);
    }
    assert(entries.some((entry) => entry.startsWith('package/dist/')));
    assert(!entries.some((entry) => /^package\/(src|test|node_modules)\//.test(entry)));
    const packedManifest = JSON.parse(
      execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }),
    );
    for (const specification of Object.values(packedManifest.dependencies ?? {})) {
      assert(!String(specification).startsWith('workspace:'));
    }
    archives.set(candidate.name, archive);
  }

  const rootManifest = readJson(join(root, 'package.json'));
  const mfManifest = readJson(join(root, 'packages/mf/package.json'));
  const reactManifest = readJson(join(root, 'packages/react/package.json'));
  const vueManifest = readJson(join(root, 'packages/vue3/package.json'));
  const dependencies = Object.fromEntries(
    [...archives].map(([name, archive]) => [name, `file:${archive}`]),
  );
  const overrides = Object.fromEntries(
    [...archives].map(([name, archive]) => [name, `file:${archive}`]),
  );
  Object.assign(dependencies, {
    '@module-federation/runtime': mfManifest.devDependencies['@module-federation/runtime'],
    '@types/react': reactManifest.devDependencies['@types/react'],
    react: reactManifest.devDependencies.react,
    'react-dom': reactManifest.devDependencies['react-dom'],
    typescript: rootManifest.devDependencies.typescript,
    vue: vueManifest.devDependencies.vue,
  });

  writeFileSync(
    join(consumerDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fronts-package-smoke',
        private: true,
        type: 'module',
        packageManager: 'pnpm@10.28.0',
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(consumerDirectory, 'pnpm-workspace.yaml'),
    `packages:\n  - .\noverrides:\n${Object.entries(overrides)
      .map(([name, archive]) => `  ${JSON.stringify(name)}: ${JSON.stringify(archive)}`)
      .join('\n')}\n`,
  );
  createSmokePrograms();

  run('pnpm', ['install', '--frozen-lockfile=false', '--ignore-scripts'], consumerDirectory);
  run('node', ['esm-smoke.mjs'], consumerDirectory);
  run('node', ['cjs-smoke.cjs'], consumerDirectory);
  run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], consumerDirectory);
  stdout.write(
    'Verified Fronts tarballs through ESM, CommonJS, public types and subpath imports.\n',
  );
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
