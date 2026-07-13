'use client';

import { create } from '@orama/orama';
import { createTokenizer } from '@orama/tokenizers/mandarin';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { oramaStaticClient } from 'fumadocs-core/search/client/orama-static';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useI18n } from 'fumadocs-ui/contexts/i18n';

function initOrama(locale?: string) {
  return create({
    schema: { _: 'string' },
    components: {
      tokenizer: locale === 'zh' ? createTokenizer() : undefined,
    },
  });
}

export default function FrontsSearchDialog(props: SharedProps) {
  const { locale } = useI18n();
  const { query, search, setSearch } = useDocsSearch({
    client: oramaStaticClient({
      initOrama,
      locale,
      search: locale === 'zh' ? { threshold: 0, tolerance: 0 } : undefined,
    }),
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
