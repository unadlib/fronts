import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/components/mdx';
import { isLocale } from '@/lib/i18n';
import { source } from '@/lib/source';
import { repositoryUrl, sourceBranch } from '@/lib/shared';

interface DocumentationPageProps {
  readonly params: Promise<{ lang: string; slug?: string[] }>;
}

export default async function DocumentationPage({ params }: DocumentationPageProps) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const page = source.getPage(slug, lang);
  if (page === undefined) notFound();

  const MDX = page.data.body;
  const githubUrl = `${repositoryUrl}/blob/${sourceBranch}/${page.data.sourcePath}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} tableOfContent={{ style: 'clerk' }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <ViewOptionsPopover githubUrl={githubUrl} />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: DocumentationPageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const page = source.getPage(slug, lang);
  if (page === undefined) notFound();

  const localizedPath = page.url;
  const alternateSlug = slug?.join('/') ?? '';

  return {
    alternates: {
      canonical: localizedPath,
      languages: {
        en: `/en/docs/${alternateSlug}`,
        'zh-CN': `/zh/docs/${alternateSlug}`,
      },
    },
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      title: page.data.title,
      type: 'article',
      url: localizedPath,
    },
    title: `${page.data.title} | Fronts 2.0`,
  };
}
