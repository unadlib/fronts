import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { isLocale, locales } from '@/lib/i18n';
import { revision } from '@/lib/shared';
import '../global.css';

export const metadata: Metadata = {
  icons: {
    icon: '/icon.svg',
  },
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang === 'zh' ? 'zh-CN' : 'en'} suppressHydrationWarning>
      <head>
        <meta name="fronts-revision" content={revision} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Provider locale={lang}>{children}</Provider>
      </body>
    </html>
  );
}
