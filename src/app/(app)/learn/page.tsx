import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";

export default async function LearnPage() {
  const user = await getCurrentUser();

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    include: {
      activeSubject: {
        include: {
          chapters: {
            orderBy: { index: "asc" },
            include: { _count: { select: { keywords: true } } },
          },
        },
      },
    },
  });
  const subject = cfg?.activeSubject;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="animate-float-in">
        <p className="text-sm text-muted">欢迎回来，</p>
        <h1 className="text-3xl font-extrabold text-ink">
          {user?.name} 👋
        </h1>
        {subject ? (
          <p className="mt-2 text-muted">
            当前学科：<span className="font-semibold text-brand-700">{subject.title}</span>
            —— 5 关 100 个关键词，每周一章，开始你的闯关吧。
          </p>
        ) : (
          <p className="mt-2 text-muted">管理员还没有开启任何学科，请稍候。</p>
        )}
      </div>

      {subject && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subject.chapters.map((ch) => (
            <div
              key={ch.id}
              className="group rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white">
                  {ch.index}
                </span>
                <div>
                  <div className="font-bold text-ink">{ch.title}</div>
                  <div className="text-xs text-muted">
                    {ch._count.keywords} 个关键词
                  </div>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-muted">{ch.theme}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        （学习闯关流程将在下一步开放）
      </p>
    </main>
  );
}
