import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import process, { stderr, stdout } from 'node:process';

const websiteRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(websiteRoot, '..');
const generatedRoot = join(websiteRoot, 'content/docs');
const contentMap = JSON.parse(readFileSync(join(websiteRoot, 'content/content-map.json'), 'utf8'));
const errors = [];

function repositoryPath(path) {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function addError(path, message) {
  errors.push(`${repositoryPath(path)}: ${message}`);
}

function parseFrontmatter(path, text) {
  const end = text.indexOf('\n---\n', 4);
  if (!text.startsWith('---\n') || end === -1) {
    addError(path, 'requires terminated frontmatter');
    return { body: text, fields: new Map() };
  }

  const fields = new Map();
  for (const line of text.slice(4, end).split('\n')) {
    const match = /^([a-zA-Z_][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match !== null) fields.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
  }
  return { body: text.slice(end + 5), fields };
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.mdx') ? [path] : [];
  });
}

function canonicalMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return canonicalMarkdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

const expectedSlugs = new Set(contentMap.pages.map((page) => page.slug));
if (expectedSlugs.size !== contentMap.pages.length) {
  errors.push('content/content-map.json: page slugs must be unique');
}

const mappedCanonicalDocs = new Set(
  contentMap.pages
    .filter((page) => page.source?.startsWith('docs/') && page.source !== 'docs/index.md')
    .map((page) => page.source),
);
const canonicalDocs = canonicalMarkdownFiles(join(repositoryRoot, 'docs'))
  .map((path) => repositoryPath(path))
  .filter((path) => !['docs/index.md', 'docs/log.md'].includes(path));
for (const source of canonicalDocs) {
  if (!mappedCanonicalDocs.has(source)) {
    errors.push(`content/content-map.json: canonical document is missing from website: ${source}`);
  }
}

for (const page of contentMap.pages) {
  for (const locale of ['en', 'zh']) {
    const path = join(generatedRoot, locale, `${page.slug}.mdx`);
    if (!existsSync(path)) {
      addError(path, 'localized page is missing');
      continue;
    }

    const text = readFileSync(path, 'utf8');
    const { body, fields } = parseFrontmatter(path, text);
    for (const field of ['title', 'description', 'sourcePath']) {
      if ((fields.get(field) ?? '') === '') addError(path, `frontmatter requires ${field}`);
    }
    if (body.trim().length < 500) addError(path, 'body is too short to be a complete guide');
    if ((body.match(/^##\s+/gm) ?? []).length < 2) addError(path, 'requires at least two sections');
    if (locale === 'zh' && !/[\u3400-\u9fff]/u.test(body)) {
      addError(path, 'Chinese page does not contain Chinese content');
    }
    if (locale === 'zh' && /(?:\]\(|href=["'])\/en\/docs(?:\/|\b)/.test(body)) {
      addError(path, 'Chinese page links back to the English documentation tree');
    }
  }
}

const generatedFiles = markdownFiles(generatedRoot);
if (generatedFiles.length !== contentMap.pages.length * 2) {
  errors.push(
    `content/docs: expected ${contentMap.pages.length * 2} generated pages, found ${generatedFiles.length}`,
  );
}

const validRoutes = new Set(
  [...expectedSlugs].flatMap((slug) => [`/en/docs/${slug}`, `/zh/docs/${slug}`]),
);
for (const path of generatedFiles) {
  const text = readFileSync(path, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\((\/[^\s)#?]+)(?:[#?][^\s)]*)?\)/g)) {
    const route = match[1].replace(/\/$/, '');
    if (route.includes('/docs/') && !validRoutes.has(route)) {
      addError(path, `internal documentation link does not map to a localized page: ${match[1]}`);
    }
  }
}

for (const page of contentMap.pages) {
  for (const property of ['chinese', page.english !== undefined ? 'english' : undefined].filter(
    Boolean,
  )) {
    const path = resolve(websiteRoot, page[property]);
    if (!existsSync(path) || !statSync(path).isFile()) addError(path, 'authored source is missing');
  }
}

if (errors.length > 0) {
  stderr.write(`Website content validation failed with ${errors.length} error(s):\n`);
  for (const error of errors) stderr.write(`- ${error}\n`);
  process.exitCode = 1;
} else {
  stdout.write(
    `Verified ${contentMap.pages.length} English/Chinese page pairs and complete canonical docs coverage.\n`,
  );
}
