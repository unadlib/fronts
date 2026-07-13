'use client';

import { use, useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(key: string, createPromise: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached as Promise<T>;

  const promise = createPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(cachePromise('mermaid', () => import('mermaid')));

  mermaid.initialize({
    fontFamily: 'inherit',
    securityLevel: 'loose',
    startOnLoad: false,
    theme: resolvedTheme === 'dark' ? 'dark' : 'default',
    themeCSS: 'margin: 1.5rem auto 0;',
  });

  const { bindFunctions, svg } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () =>
      mermaid.render(id, chart.replaceAll('\\n', '\n')),
    ),
  );

  return (
    <div
      className="my-6 overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-4"
      ref={(container) => {
        if (container !== null) bindFunctions?.(container);
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <MermaidContent chart={chart} />;
}
