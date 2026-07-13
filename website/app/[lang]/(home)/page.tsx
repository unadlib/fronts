import { ArrowRight, Boxes, GitBranch, ShieldCheck, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';

const content = {
  en: {
    badge: 'Fronts 2.0 · prerelease',
    description:
      'Fronts governs application identity, lifecycle, policy, isolation, capabilities, readiness, replacement, and audit while Module Federation owns module delivery.',
    docs: 'Start reading',
    eyebrow: 'APPLICATION RUNTIME',
    features: [
      [
        'Application ABI',
        'One framework-neutral lifecycle contract for vanilla, React, and Vue applications.',
      ],
      [
        'Governed delivery',
        'Resolve by environment, tenant, cohort, version, or channel before loading.',
      ],
      [
        'Isolation choices',
        'Use DOM, Shadow DOM, or cross-origin iframe behind one Host transaction.',
      ],
      [
        'Safe replacement',
        'Stage until ready, commit atomically, and keep the current application on failure.',
      ],
    ],
    getStarted: 'Quick start',
    title: 'A governed application runtime for independently delivered frontends.',
  },
  zh: {
    badge: 'Fronts 2.0 · 预发布',
    description:
      'Module Federation 负责模块交付；Fronts 负责应用身份、生命周期、策略、隔离、能力授权、就绪、替换与审计。',
    docs: '开始阅读',
    eyebrow: '应用运行时',
    features: [
      ['应用 ABI', '为原生、React 与 Vue 应用提供同一套框架无关生命周期契约。'],
      ['受治理的交付', '加载前按环境、租户、分群、版本或发布通道解析具体部署。'],
      ['多种隔离边界', '通过统一 Host 事务选择 DOM、Shadow DOM 或跨域 iframe。'],
      ['安全替换', '候选应用就绪后原子提交；失败时继续保留当前可用实例。'],
    ],
    getStarted: '快速开始',
    title: '面向独立交付前端的受治理应用运行时。',
  },
} as const;

const icons = [Boxes, GitBranch, ShieldCheck, Sparkles];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = content[lang];
  return {
    alternates: {
      languages: { en: '/en', 'zh-CN': '/zh' },
    },
    description: copy.description,
    title: `Fronts 2.0 — ${copy.title}`,
  };
}

export default async function LocaleHomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = content[lang];

  return (
    <main className="fronts-grid flex-1 overflow-hidden">
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
        <div className="absolute right-[-10rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <p className="mb-6 text-sm font-semibold tracking-[0.22em] text-blue-600 dark:text-blue-400">
            {copy.eyebrow}
          </p>
          <div className="mb-6 inline-flex rounded-full border border-fd-border bg-fd-card/70 px-3 py-1 text-xs text-fd-muted-foreground">
            {copy.badge}
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-[-0.05em] md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-lg leading-8 text-fd-muted-foreground md:text-xl">
            {copy.description}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={`/${lang}/docs`}
              className="inline-flex items-center gap-2 rounded-xl bg-fd-primary px-5 py-3 font-medium text-fd-primary-foreground transition hover:opacity-90"
            >
              {copy.docs} <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`/${lang}/docs/getting-started`}
              className="inline-flex items-center rounded-xl border border-fd-border bg-fd-card px-5 py-3 font-medium transition hover:bg-fd-accent"
            >
              {copy.getStarted}
            </Link>
          </div>
        </div>

        <div className="relative mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {copy.features.map(([title, description], index) => {
            const Icon = icons[index];
            return (
              <article key={title} className="fronts-card rounded-2xl p-6">
                <Icon className="mb-5 size-6 text-blue-500" />
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
