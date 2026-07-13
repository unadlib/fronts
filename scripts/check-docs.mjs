import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process, { stderr, stdout } from 'node:process';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const docsDirectory = join(root, 'docs');
const allowedTypes = new Set([
  'repo-overview',
  'architecture',
  'adr',
  'domain-rule',
  'module-readme',
  'feature-spec',
  'test-plan',
  'rollout',
  'contract',
  'runbook',
  'operations',
]);
const allowedStatuses = new Set([
  'draft',
  'proposed',
  'accepted',
  'deprecated',
  'superseded',
  'rejected',
]);
const terminalStatuses = new Set(['deprecated', 'superseded', 'rejected']);
const unresolvedMarkerPattern =
  /\b(?:TODO|UNKNOWN|NEEDS_OWNER|NEEDS_TEST|NEEDS_ADR|NEEDS_CONTRACT|NEEDS_REVIEW)\b/;
const forbiddenCurrentApiPatterns = [
  { label: '@fronts/core/legacy', pattern: /@fronts\/core\/legacy/ },
  { label: 'fronts-transport', pattern: /fronts-transport/ },
  { label: 'globalTransport', pattern: /globalTransport/ },
];
const errors = [];

function repositoryPath(path) {
  return relative(root, path).split(sep).join('/');
}

function addError(path, message, line) {
  const location = line === undefined ? repositoryPath(path) : `${repositoryPath(path)}:${line}`;
  errors.push(`${location}: ${message}`);
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

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLinks(text) {
  const links = [];
  const inlinePattern = /!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\)/g;
  const referencePattern = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm;

  for (const pattern of [inlinePattern, referencePattern]) {
    for (const match of text.matchAll(pattern)) {
      links.push({ index: match.index, target: match[1] });
    }
  }

  return links;
}

function localLinkPath(sourcePath, rawTarget) {
  let target =
    rawTarget.startsWith('<') && rawTarget.endsWith('>') ? rawTarget.slice(1, -1) : rawTarget;

  if (
    target === '' ||
    target.startsWith('#') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return undefined;
  }

  target = target.split('#', 1)[0].split('?', 1)[0];
  if (target === '') {
    return undefined;
  }

  try {
    target = decodeURIComponent(target);
  } catch {
    return { invalidEncoding: true, path: target };
  }

  return {
    invalidEncoding: false,
    path: target.startsWith('/')
      ? resolve(root, `.${target}`)
      : resolve(dirname(sourcePath), target),
  };
}

function validateLinks(markdownFiles) {
  for (const file of markdownFiles) {
    const text = readFileSync(file, 'utf8');

    for (const link of extractLinks(text)) {
      const local = localLinkPath(file, link.target);
      if (local === undefined) {
        continue;
      }
      if (local.invalidEncoding) {
        addError(
          file,
          `local link has invalid percent encoding: ${link.target}`,
          lineAt(text, link.index),
        );
        continue;
      }
      if (!local.path.startsWith(`${root}${sep}`) && local.path !== root) {
        addError(
          file,
          `local link escapes the repository: ${link.target}`,
          lineAt(text, link.index),
        );
        continue;
      }
      if (!existsSync(local.path)) {
        addError(file, `local link does not resolve: ${link.target}`, lineAt(text, link.index));
      }
    }
  }
}

function parseFrontmatter(path, text) {
  if (!text.startsWith('---\n')) {
    return undefined;
  }

  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    addError(path, 'frontmatter is not terminated');
    return undefined;
  }

  const fields = new Map();
  for (const [offset, line] of text.slice(4, end).split('\n').entries()) {
    if (line.trim() === '' || /^\s/.test(line)) {
      continue;
    }
    const match = /^([a-z_]+):\s*(.*?)\s*$/.exec(line);
    if (match === null) {
      addError(path, `frontmatter line is not a simple key/value field: ${line}`, offset + 2);
      continue;
    }
    if (fields.has(match[1])) {
      addError(path, `frontmatter field is duplicated: ${match[1]}`, offset + 2);
    }
    fields.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
  }

  return { body: text.slice(end + 5), fields };
}

function validateConceptDocument(path) {
  const text = readFileSync(path, 'utf8');
  const parsed = parseFrontmatter(path, text);
  if (parsed === undefined) {
    addError(path, 'concept document requires YAML frontmatter');
    return undefined;
  }

  for (const field of ['type', 'title', 'description', 'owner', 'status']) {
    if ((parsed.fields.get(field) ?? '') === '') {
      addError(path, `frontmatter requires a non-empty ${field}`);
    }
  }

  const type = parsed.fields.get('type');
  if (type !== undefined && !allowedTypes.has(type)) {
    addError(path, `frontmatter type is not supported: ${type}`);
  }

  const status = parsed.fields.get('status');
  if (status !== undefined && !allowedStatuses.has(status)) {
    addError(path, `frontmatter status is not supported: ${status}`);
  }
  if (unresolvedMarkerPattern.test(text) && status !== 'proposed') {
    addError(path, 'documents with unresolved markers must use status: proposed');
  }
  if (type === 'adr' && (parsed.fields.get('risk_level') ?? '') === '') {
    addError(path, 'ADR frontmatter requires risk_level');
  }
  if (!/^## Verification\s*$/m.test(parsed.body) && !/Verification:\s*Missing/.test(parsed.body)) {
    addError(path, 'concept document requires a Verification section or Verification: Missing');
  }

  return { status };
}

function validateDocumentationInventory() {
  const conceptFiles = readdirSync(docsDirectory)
    .filter((name) => name.endsWith('.md') && name !== 'index.md' && name !== 'log.md')
    .map((name) => join(docsDirectory, name));
  const currentConcepts = [];

  for (const file of conceptFiles) {
    const metadata = validateConceptDocument(file);
    if (metadata !== undefined && !terminalStatuses.has(metadata.status)) {
      currentConcepts.push(file);
    }
  }

  for (const rootConcept of [join(root, 'CONTRIBUTING.md'), join(root, 'SECURITY.md')]) {
    validateConceptDocument(rootConcept);
  }

  const indexPath = join(docsDirectory, 'index.md');
  const indexText = readFileSync(indexPath, 'utf8');
  if (indexText.startsWith('---\n')) {
    addError(indexPath, 'reserved mixed-root index must not have concept frontmatter');
  }
  const indexedPaths = new Set(
    extractLinks(indexText)
      .map((link) => localLinkPath(indexPath, link.target))
      .filter((link) => link !== undefined && !link.invalidEncoding)
      .map((link) => link.path),
  );

  for (const file of currentConcepts) {
    if (!indexedPaths.has(file)) {
      addError(indexPath, `current concept is missing from the index: ${repositoryPath(file)}`);
    }
  }
}

function interfaceMembers(source, interfaceName, memberKind) {
  let declaration;

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      declaration = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  if (declaration === undefined) {
    throw new Error(`Unable to find interface ${interfaceName}`);
  }

  return declaration.members
    .filter(memberKind)
    .map((member) => member.name)
    .filter((name) => name !== undefined)
    .map((name) => name.getText(source).replace(/^['"]|['"]$/g, ''));
}

function validateHostApiCoverage() {
  const typesPath = join(root, 'packages/core/src/host/types.ts');
  const typesText = readFileSync(typesPath, 'utf8');
  const source = ts.createSourceFile(
    typesPath,
    typesText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const guidePath = join(docsDirectory, 'host-runtime-api.md');
  const guide = readFileSync(guidePath, 'utf8');
  const hostMethods = interfaceMembers(source, 'FrontsHost', ts.isMethodSignature);
  const mountedMethods = interfaceMembers(source, 'MountedApplication', ts.isMethodSignature);
  const hostOptions = interfaceMembers(source, 'FrontsHostOptions', ts.isPropertySignature);

  for (const method of [...new Set([...hostMethods, ...mountedMethods])]) {
    const callPattern = new RegExp('`' + escapeRegularExpression(method) + '\\([^`]*\\)`');
    if (!callPattern.test(guide)) {
      addError(guidePath, `public runtime method is not documented as an inline call: ${method}`);
    }
  }

  for (const option of hostOptions) {
    if (!guide.includes(`\`${option}\``)) {
      addError(guidePath, `FrontsHostOptions field is not documented: ${option}`);
    }
  }
}

function validateRemovedApiAbsence(markdownFiles) {
  for (const file of markdownFiles) {
    const text = readFileSync(file, 'utf8');
    for (const forbidden of forbiddenCurrentApiPatterns) {
      const match = forbidden.pattern.exec(text);
      if (match !== null) {
        addError(
          file,
          `removed pre-2.0 API appears in current documentation: ${forbidden.label}`,
          lineAt(text, match.index),
        );
      }
    }
  }
}

const markdownFiles = trackedMarkdownFiles();
validateLinks(markdownFiles);
validateDocumentationInventory();
validateHostApiCoverage();
validateRemovedApiAbsence(markdownFiles);

if (errors.length > 0) {
  stderr.write(`Documentation validation failed with ${errors.length} error(s):\n`);
  for (const error of errors) {
    stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  const conceptCount = readdirSync(docsDirectory).filter(
    (name) => name.endsWith('.md') && !['index.md', 'log.md'].includes(name),
  ).length;
  const fileCount = markdownFiles.filter((path) => statSync(path).isFile()).length;
  stdout.write(
    `Verified ${fileCount} Markdown files, ${conceptCount} indexed concept documents, and the public Host API guide.\n`,
  );
}
