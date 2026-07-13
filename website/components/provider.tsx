'use client';

import { i18nProvider } from 'fumadocs-ui/i18n';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { translations } from '@/lib/translations';
import SearchDialog from './search';

export function Provider({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <RootProvider
      i18n={i18nProvider(translations, locale)}
      search={{
        SearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
}
