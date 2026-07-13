import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { stdout } from 'node:process';

const websiteRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(websiteRoot, '..');
const generatedRoot = join(websiteRoot, 'content/docs');
const contentMapPath = join(websiteRoot, 'content/content-map.json');
const contentMap = JSON.parse(readFileSync(contentMapPath, 'utf8'));
const locales = ['en', 'zh'];

function repositoryPath(path) {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function parseFrontmatter(path, text) {
  if (!text.startsWith('---\n')) {
    return { body: text, fields: new Map() };
  }

  const end = text.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`Unterminated frontmatter in ${repositoryPath(path)}`);

  const fields = new Map();
  for (const line of text.slice(4, end).split('\n')) {
    const match = /^([a-zA-Z_][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match !== null) fields.set(match[1], match[2].replace(/^(['"])(.*)\1$/, '$2'));
  }

  return { body: text.slice(end + 5), fields };
}

function removeDocumentTitle(body) {
  return body.replace(/^\s*#\s+[^\n]+\n+/, '');
}

function outputFrontmatter({ description, sourcePath, title }) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nsourcePath: ${JSON.stringify(sourcePath)}\n---\n\n`;
}

const sourceToSlug = new Map(
  contentMap.pages
    .filter((page) => page.source !== undefined)
    .map((page) => [resolve(repositoryRoot, page.source), page.slug]),
);

function rewriteRepositoryLinks(body, sourcePath, locale) {
  const linkPattern = /(!?\[[^\]]*\]\()(<[^>]+>|[^\s)]+)(\s+["'][^"']*["'])?(\))/g;

  return body.replace(linkPattern, (full, prefix, rawTarget, title, suffix) => {
    const wrapped = rawTarget.startsWith('<') && rawTarget.endsWith('>');
    const target = wrapped ? rawTarget.slice(1, -1) : rawTarget;
    if (target.startsWith('#') || target.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(target)) {
      return full;
    }

    const hashIndex = target.indexOf('#');
    const queryIndex = target.indexOf('?');
    const endIndex = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    const pathPart = endIndex === undefined ? target : target.slice(0, endIndex);
    const suffixPart = endIndex === undefined ? '' : target.slice(endIndex);
    if (pathPart === '') return full;

    const resolved = pathPart.startsWith('/')
      ? resolve(repositoryRoot, `.${pathPart}`)
      : resolve(dirname(sourcePath), decodeURIComponent(pathPart));
    if (!resolved.startsWith(`${repositoryRoot}${sep}`) && resolved !== repositoryRoot) return full;

    const documentationSlug = sourceToSlug.get(resolved);
    let replacement;
    if (documentationSlug !== undefined) {
      replacement = `/${locale}/docs/${documentationSlug}${suffixPart}`;
    } else if (existsSync(resolved)) {
      const route = statSync(resolved).isDirectory() ? 'tree' : 'blob';
      replacement = `https://github.com/unadlib/fronts/${route}/main/${repositoryPath(resolved)}${suffixPart}`;
    } else {
      return full;
    }

    return `${prefix}${wrapped ? `<${replacement}>` : replacement}${title ?? ''}${suffix}`;
  });
}

function readAuthoredPage(path, sourcePath, locale) {
  const text = readFileSync(path, 'utf8');
  const { body, fields } = parseFrontmatter(path, text);
  const title = fields.get('title');
  const description = fields.get('description');
  if (title === undefined || description === undefined) {
    throw new Error(`${repositoryPath(path)} requires title and description frontmatter`);
  }

  return {
    body: rewriteRepositoryLinks(removeDocumentTitle(body), path, locale),
    description,
    sourcePath,
    title,
  };
}

function readCanonicalPage(page) {
  const path = resolve(repositoryRoot, page.source);
  const text = readFileSync(path, 'utf8');
  const { body, fields } = parseFrontmatter(path, text);
  const title = fields.get('title') ?? page.title;
  const description = fields.get('description') ?? page.description;
  if (title === undefined || description === undefined) {
    throw new Error(`${page.source} requires mapped or frontmatter title and description`);
  }

  return {
    body: rewriteRepositoryLinks(removeDocumentTitle(body), path, 'en'),
    description,
    sourcePath: page.source,
    title,
  };
}

function writePage(locale, slug, page) {
  const destination = join(generatedRoot, locale, `${slug}.mdx`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${outputFrontmatter(page)}${page.body.trim()}\n`);
}

function writeNavigation(locale) {
  const rootPages = ['index', 'getting-started'];
  for (const category of contentMap.categories) {
    rootPages.push(`---${category.titles[locale]}---`, category.id);
    const directory = join(generatedRoot, locale, category.id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'meta.json'),
      `${JSON.stringify({ pages: category.pages, title: category.titles[locale] }, null, 2)}\n`,
    );
  }

  writeFileSync(
    join(generatedRoot, locale, 'meta.json'),
    `${JSON.stringify({ pages: rootPages, title: locale === 'zh' ? 'Fronts 2.0 文档' : 'Fronts 2.0 Documentation' }, null, 2)}\n`,
  );
}

rmSync(generatedRoot, { force: true, recursive: true });

for (const page of contentMap.pages) {
  const english =
    page.english !== undefined
      ? readAuthoredPage(resolve(websiteRoot, page.english), page.english, 'en')
      : readCanonicalPage(page);
  writePage('en', page.slug, english);

  const chinesePath = resolve(websiteRoot, page.chinese);
  const chinese = readAuthoredPage(chinesePath, page.chinese, 'zh');
  writePage('zh', page.slug, chinese);
}

for (const locale of locales) writeNavigation(locale);

stdout.write(
  `Generated ${contentMap.pages.length * locales.length} localized documentation pages.\n`,
);
