import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process, { stderr, stdout } from 'node:process';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const fixtureDirectory = join(root, 'scripts/doc-examples');
const publicImportPattern = /^\s*import\b[^;]*?from\s*['"]@fronts\/[^'"]+['"]/m;
const markerPattern = /^<!--\s*typecheck(?::\s*(.+?))?\s*-->$/;
const errors = [];

function repositoryPath(path) {
  return relative(root, path).split(sep).join('/');
}

function trackedMarkdownFiles() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path.endsWith('.md'))
    .map((path) => join(root, path));
}

/**
 * Collects fenced TypeScript examples and the `<!-- typecheck -->` directive above each one.
 *
 * A fence importing a public `@fronts/*` entry point is an example a reader can paste, so it must
 * declare its intent. Everything else is prose-scoped and stays unchecked.
 */
function collectExamples(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const examples = [];
  let index = 0;

  while (index < lines.length) {
    const opening = /^```(tsx?)$/.exec(lines[index] ?? '');
    if (opening === null) {
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < lines.length && lines[end] !== '```') {
      end += 1;
    }

    let directive;
    for (let above = index - 1; above >= 0; above -= 1) {
      const candidate = (lines[above] ?? '').trim();
      if (candidate === '') {
        continue;
      }
      directive =
        markerPattern.exec(candidate)?.[1] ?? (markerPattern.test(candidate) ? '' : undefined);
      break;
    }

    const body = lines.slice(index + 1, end).join('\n');
    if (directive === undefined) {
      if (publicImportPattern.test(body)) {
        errors.push(
          `${repositoryPath(file)}:${index + 1}: example imports a public @fronts entry point and requires a <!-- typecheck --> directive`,
        );
      }
    } else {
      examples.push({ body, directive, extension: opening[1], file, line: index + 1 });
    }

    index = end + 1;
  }

  return examples;
}

/**
 * Resolves a directive into ambient reference lines plus sibling modules to copy.
 *
 * A `<name>.d.ts` fixture supplies identifiers the surrounding prose established, so the example
 * stays focused on the call being explained. A `<name>.ts` fixture is copied next to the example
 * instead, which lets an example keep a realistic local import such as `./contracts.js`.
 */
function fixturePlan(directive, file, line) {
  if (directive === '') {
    return { expectError: false, references: [], siblings: [] };
  }
  const [keyword, ...rest] = directive.split(/\s+/);
  if (keyword === 'skip') {
    if (rest.join(' ').trim() === '') {
      errors.push(`${repositoryPath(file)}:${line}: a skipped example must state why`);
    }
    return undefined;
  }

  const references = [];
  const siblings = [];
  let expectError = false;
  for (const name of directive.split(/\s*,\s*/)) {
    if (name === 'expect-error') {
      expectError = true;
      continue;
    }
    const ambient = join(fixtureDirectory, `${name}.d.ts`);
    const module = join(fixtureDirectory, `${name}.ts`);
    if (existsSync(ambient)) {
      references.push(`/// <reference path="${ambient}" />`);
    } else if (existsSync(module)) {
      siblings.push({ name, path: module });
    } else {
      errors.push(`${repositoryPath(file)}:${line}: unknown typecheck fixture "${name}"`);
    }
  }
  return { expectError, references, siblings };
}

const workspace = mkdtempSync(join(tmpdir(), 'fronts-doc-examples-'));

try {
  const markdownFiles = trackedMarkdownFiles();
  const compiled = [];
  const rejected = new Set();
  mkdirSync(join(workspace, 'cases'), { recursive: true });

  for (const file of markdownFiles) {
    for (const example of collectExamples(file)) {
      const plan = fixturePlan(example.directive, example.file, example.line);
      if (plan === undefined) {
        continue;
      }
      for (const sibling of plan.siblings) {
        copyFileSync(sibling.path, join(workspace, 'cases', `${sibling.name}.ts`));
      }
      const name = `${repositoryPath(example.file).replace(/[^a-zA-Z0-9]+/g, '-')}-${example.line}.${example.extension}`;
      const path = join(workspace, 'cases', name);
      writeFileSync(path, `${[...plan.references, ''].join('\n')}${example.body}\n`);
      compiled.push({
        ...example,
        expectError: plan.expectError,
        name,
        offset: plan.references.length,
        path,
      });
    }
  }

  if (compiled.length > 0) {
    /**
     * Resolves a dependency from the workspace package that declares it. No single directory in a
     * pnpm workspace can resolve every dependency the documentation uses, so each specifier is
     * mapped explicitly rather than relying on directory walk-up from a temporary directory.
     */
    const packageDirectory = (specifier, owner) =>
      dirname(
        execFileSync(
          process.execPath,
          [
            '-e',
            `process.stdout.write(require.resolve(${JSON.stringify(`${specifier}/package.json`)}))`,
          ],
          { cwd: join(root, owner), encoding: 'utf8' },
        ),
      );

    const dependencies = [
      ['@types/react', 'react', 'packages/react'],
      ['@types/react-dom', 'react-dom', 'packages/react'],
      ['vue', 'vue', 'packages/vue3'],
      ['@module-federation/runtime', '@module-federation/runtime', 'packages/mf'],
    ];

    const paths = Object.fromEntries([
      ...[
        ['@fronts/core', 'packages/core/dist/index.d.ts'],
        ['@fronts/core/iframe', 'packages/core/dist/iframe.d.ts'],
        ['@fronts/mf', 'packages/mf/dist/index.d.ts'],
        ['@fronts/react', 'packages/react/dist/index.d.ts'],
        ['@fronts/vue3', 'packages/vue3/dist/index.d.ts'],
      ].map(([specifier, path]) => [specifier, [join(root, path)]]),
      ...dependencies.flatMap(([resolved, specifier, owner]) => {
        const directory = packageDirectory(resolved, owner);
        return [
          [specifier, [directory]],
          [`${specifier}/*`, [join(directory, '*')]],
        ];
      }),
    ]);
    const compilerOptions = {
      exactOptionalPropertyTypes: true,
      jsx: ts.JsxEmit.ReactJSX,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Force,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      noUncheckedIndexedAccess: true,
      paths,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      types: [],
      verbatimModuleSyntax: true,
    };

    // Each example gets a fresh Program. Reusing one Program would merge ambient fixture globals
    // across unrelated fences and could make an example compile only because another one ran too.
    for (const example of compiled) {
      const program = ts.createProgram({
        options: compilerOptions,
        rootNames: [example.path],
      });
      for (const diagnostic of ts
        .getPreEmitDiagnostics(program)
        .filter(({ category }) => category === ts.DiagnosticCategory.Error)) {
        const diagnosticPath =
          diagnostic.file === undefined ? undefined : resolve(diagnostic.file.fileName);
        const belongsToExample = diagnosticPath === resolve(example.path);
        if (belongsToExample && example.expectError) {
          rejected.add(example.name);
          continue;
        }

        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        if (diagnostic.file === undefined || diagnostic.start === undefined) {
          errors.push(`TS${diagnostic.code}: ${message}`);
          continue;
        }

        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const line = belongsToExample
          ? example.line + position.line + 1 - example.offset
          : position.line + 1;
        const path = belongsToExample
          ? repositoryPath(example.file)
          : diagnosticPath.startsWith(`${root}${sep}`)
            ? repositoryPath(diagnosticPath)
            : relative(workspace, diagnosticPath).split(sep).join('/');
        errors.push(`${path}:${line}:${position.character + 1}: TS${diagnostic.code}: ${message}`);
      }
    }

    for (const example of compiled) {
      if (example.expectError === true && !rejected.has(example.name)) {
        errors.push(
          `${repositoryPath(example.file)}:${example.line}: example is marked expect-error but compiles`,
        );
      }
    }
  }

  if (errors.length > 0) {
    stderr.write(`Documentation example validation failed with ${errors.length} error(s):\n`);
    for (const error of errors) {
      stderr.write(`- ${error}\n`);
    }
    process.exitCode = 1;
  } else {
    const files = new Set(compiled.map((example) => repositoryPath(example.file)));
    stdout.write(
      `Type-checked ${compiled.length} documentation examples across ${files.size} files.\n`,
    );
  }
} finally {
  rmSync(workspace, { force: true, recursive: true });
}
