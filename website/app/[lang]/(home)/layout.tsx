import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { isLocale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

export default async function LocaleHomeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <HomeLayout {...baseOptions(lang)}>{children}</HomeLayout>;
}
