import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import process, { stderr, stdout } from 'node:process';

const websiteRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(websiteRoot, 'out');
const contentMap = JSON.parse(readFileSync(join(websiteRoot, 'content/content-map.json'), 'utf8'));
const revision = process.env.NEXT_PUBLIC_FRONTS_REVISION ?? undefined;
const errors = [];

function outputPath(path) {
  return relative(outputRoot, path).split(sep).join('/');
}

function addError(path, message) {
  errors.push(`${outputPath(path)}: ${message}`);
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\//, '').replace(/\/$/, '');
  if (clean === '') return join(outputRoot, 'index.html');
  if (extname(clean) !== '') return join(outputRoot, clean);

  const directoryIndex = join(outputRoot, clean, 'index.html');
  if (existsSync(directoryIndex)) return directoryIndex;
  const htmlFile = join(outputRoot, `${clean}.html`);
  if (existsSync(htmlFile)) return htmlFile;
  return directoryIndex;
}

if (!existsSync(outputRoot)) {
  stderr.write('website/out does not exist; run pnpm build first.\n');
  process.exit(1);
}

const expectedPages = [join(outputRoot, 'index.html')];
for (const locale of ['en', 'zh']) {
  expectedPages.push(join(outputRoot, locale, 'index.html'));
  for (const page of contentMap.pages) {
    expectedPages.push(
      page.slug === 'index'
        ? join(outputRoot, locale, 'docs', 'index.html')
        : join(outputRoot, locale, 'docs', page.slug, 'index.html'),
    );
  }
}

for (const path of expectedPages) {
  if (!existsSync(path)) addError(path, 'expected static page is missing');
}

const htmlFiles = files(outputRoot).filter((path) => path.endsWith('.html'));
const applicationHtmlFiles = htmlFiles.filter(
  (path) => !['404.html', '404/index.html', '_not-found/index.html'].includes(outputPath(path)),
);
for (const path of applicationHtmlFiles) {
  const html = readFileSync(path, 'utf8');
  const expectedLanguage = outputPath(path).startsWith('zh/') ? 'zh-CN' : 'en';
  if (!new RegExp(`<html[^>]+lang=["']${expectedLanguage}["']`).test(html)) {
    addError(path, `expected html language ${expectedLanguage}`);
  }
  if (!/name=["']fronts-revision["']/.test(html)) addError(path, 'revision metadata is missing');
  if (revision !== undefined && !html.includes(revision))
    addError(path, 'revision metadata is stale');

  for (const match of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const target = match[1];
    if (
      target.startsWith('#') ||
      target.startsWith('//') ||
      /^(?:data|mailto|tel|https?):/i.test(target)
    ) {
      continue;
    }

    const url = new globalThis.URL(target, `https://fronts.js.org/${outputPath(path)}`);
    const targetPath = routeFile(url.pathname);
    if (!existsSync(targetPath)) addError(path, `local asset or route does not resolve: ${target}`);
  }
}

const searchFiles = files(join(outputRoot, 'api')).filter((path) =>
  outputPath(path).includes('search'),
);
if (searchFiles.length === 0) {
  errors.push('api/search: static search index is missing');
} else {
  const searchText = searchFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const requiredText of ['Host Runtime API', 'Host 运行时 API']) {
    if (!searchText.includes(requiredText)) {
      errors.push(`api/search: localized search index is missing ${requiredText}`);
    }
  }
}

if (errors.length > 0) {
  stderr.write(`Static website validation failed with ${errors.length} error(s):\n`);
  for (const error of errors) stderr.write(`- ${error}\n`);
  process.exitCode = 1;
} else {
  stdout.write(
    `Verified ${applicationHtmlFiles.length} application HTML files, localized routes, assets, revision metadata, and search indexes.\n`,
  );
}
