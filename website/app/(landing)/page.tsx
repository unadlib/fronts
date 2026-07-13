import { ArrowRight, BookOpen, Code2 } from 'lucide-react';
import Link from 'next/link';
import { repositoryUrl } from '@/lib/shared';

export default function LanguageLandingPage() {
  return (
    <main className="fronts-grid relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/15 blur-3xl" />
      <section className="relative mx-auto w-full max-w-5xl text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="fronts-logo-mark text-lg font-bold" aria-hidden="true">
            F
          </span>
          <span className="text-lg font-semibold tracking-tight">Fronts 2.0</span>
        </div>
        <p className="mx-auto mb-4 inline-flex rounded-full border border-fd-border bg-fd-card/70 px-4 py-1.5 text-sm text-fd-muted-foreground">
          Framework-neutral application runtime · 框架无关的应用运行时
        </p>
        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold tracking-[-0.045em] md:text-7xl">
          Govern applications beyond <span className="fronts-gradient-text">module loading</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-fd-muted-foreground md:text-xl">
          One application contract across frameworks, loaders, isolation boundaries, deployment
          policy, readiness, rollback, and capability-scoped services.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-7 text-fd-muted-foreground">
          用统一应用契约治理不同框架、加载方式、隔离边界、部署策略、就绪切换与能力服务。
        </p>

        <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
          <Link
            href="/en"
            className="fronts-card group rounded-2xl p-7 text-left transition hover:-translate-y-1 hover:border-blue-500/50"
          >
            <span className="mb-5 inline-flex rounded-xl bg-blue-500/10 p-3 text-blue-500">
              <BookOpen />
            </span>
            <span className="flex items-center justify-between text-xl font-semibold">
              Read in English
              <ArrowRight className="transition group-hover:translate-x-1" />
            </span>
            <span className="mt-2 block text-sm leading-6 text-fd-muted-foreground">
              Architecture, runtime API, integrations, operations, and release guidance.
            </span>
          </Link>
          <Link
            href="/zh"
            className="fronts-card group rounded-2xl p-7 text-left transition hover:-translate-y-1 hover:border-cyan-500/50"
          >
            <span className="mb-5 inline-flex rounded-xl bg-cyan-500/10 p-3 font-semibold text-cyan-600">
              中
            </span>
            <span className="flex items-center justify-between text-xl font-semibold">
              阅读中文文档
              <ArrowRight className="transition group-hover:translate-x-1" />
            </span>
            <span className="mt-2 block text-sm leading-6 text-fd-muted-foreground">
              完整了解架构、运行时 API、集成边界、运维与发布流程。
            </span>
          </Link>
        </div>

        <a
          className="mt-9 inline-flex items-center gap-2 text-sm text-fd-muted-foreground transition hover:text-fd-foreground"
          href={repositoryUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Code2 className="size-4" />
          unadlib/fronts
        </a>
      </section>
    </main>
  );
}
