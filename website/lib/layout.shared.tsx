import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BookOpen, Code2 } from 'lucide-react';
import type { Locale } from './i18n';
import { appName, repositoryUrl } from './shared';

const copy = {
  en: {
    docs: 'Documentation',
  },
  zh: {
    docs: '文档',
  },
} as const;

export function baseOptions(locale: Locale): BaseLayoutProps {
  return {
    githubUrl: repositoryUrl,
    links: [
      {
        icon: <BookOpen />,
        text: copy[locale].docs,
        url: `/${locale}/docs`,
      },
      {
        external: true,
        icon: <Code2 />,
        text: 'GitHub',
        url: repositoryUrl,
      },
    ],
    nav: {
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <span className="fronts-logo-mark" aria-hidden="true">
            F
          </span>
          {appName}
        </span>
      ),
      url: `/${locale}`,
    },
  };
}
