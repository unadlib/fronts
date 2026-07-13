import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-widest text-blue-500">404</p>
      <h1 className="mt-4 text-4xl font-bold">Page not found · 页面不存在</h1>
      <p className="mt-4 text-fd-muted-foreground">
        The requested documentation page is unavailable. 请求的文档页面不存在或已移动。
      </p>
      <Link className="mt-8 rounded-xl bg-fd-primary px-5 py-3 text-fd-primary-foreground" href="/">
        Choose a language · 选择语言
      </Link>
    </main>
  );
}
