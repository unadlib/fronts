import { defineI18n } from 'fumadocs-core/i18n';

export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const i18n = defineI18n({
  defaultLanguage: 'en',
  fallbackLanguage: null,
  languages: [...locales],
  parser: 'dir',
});

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
