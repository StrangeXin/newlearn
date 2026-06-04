import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-20 text-center">
      <div className="text-6xl">🧭</div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">页面走丢了</h1>
      <p className="mt-2 text-muted">你访问的内容不存在，或者还没解锁。</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
      >
        回首页
      </Link>
    </main>
  );
}
