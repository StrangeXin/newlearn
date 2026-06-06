import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import {
  CreateSubjectForm,
  ImportContentForm,
  KeywordEditor,
  SetActiveButton,
  StartDateForm,
} from "./content-forms";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  const m = `${x.getMonth() + 1}`.padStart(2, "0");
  const day = `${x.getDate()}`.padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export default async function AdminContentPage() {
  await requireAdmin();

  const [subjects, cfg] = await Promise.all([
    prisma.subject.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { chapters: true } } },
    }),
    prisma.activeSubjectConfig.findUnique({
      where: { singletonId: "GLOBAL" },
      select: { activeSubjectId: true },
    }),
  ]);
  const activeId = cfg?.activeSubjectId ?? null;
  const activeSubject = activeId
    ? await prisma.subject.findUnique({
        where: { id: activeId },
        include: {
          chapters: {
            orderBy: { index: "asc" },
            include: { keywords: { orderBy: { orderIndex: "asc" } } },
          },
        },
      })
    : null;

  return (
    <main className="animate-float-in page py-8">
      <Link
        href="/admin"
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">学科与内容</h1>
      <p className="mt-1 text-sm text-muted">
        新建学科后用 JSON 一次导入「5 章 100 词」，再逐词补全简介与考核要点。设为当前学科后员工才能闯关。
      </p>

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">学科</h2>
          <span className="text-xs font-medium text-muted">
            共 {subjects.length} 个
          </span>
        </div>
        <div className="card mb-3 p-4">
          <CreateSubjectForm />
        </div>
        {subjects.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="badge badge-muted">还没有学科</span>
            <p className="mt-3 max-w-sm text-sm text-muted">
              填一个学科名（如「人工智能」），新建后导入章节。
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {subjects.map((s) => {
              const isActive = s.id === activeId;
              return (
                <li
                  key={s.id}
                  className={`px-4 py-3.5 ${isActive ? "bg-brand-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">{s.title}</span>
                      <span className="ml-2 text-xs font-medium text-muted">
                        {s._count.chapters > 0
                          ? `${s._count.chapters} 章`
                          : "未导入内容"}
                      </span>
                    </div>
                    <SetActiveButton subjectId={s.id} active={isActive} />
                  </div>
                  {s._count.chapters === 0 && (
                    <div className="mt-3">
                      <ImportContentForm subjectId={s.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeSubject && (
        <>
          <section className="card mt-6 p-4">
            <h2 className="text-lg font-bold text-ink">开课开始日</h2>
            <p className="field-hint mb-3 mt-0.5">
              从这一天所在的自然周（周一到周日）起算，每周顺序解锁一章。
            </p>
            <StartDateForm value={toDateInput(activeSubject.startDate)} />
          </section>

          <section className="mt-6">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">关键词内容</h2>
              <span className="badge badge-success">
                ✓ 当前学科 · {activeSubject.title}
              </span>
            </div>
            <p className="field-hint mb-4">
              点开关键词填简介与考核要点。简介对员工可见，考核要点只用来辅助 AI 打分。
            </p>
            <div className="space-y-6">
              {activeSubject.chapters.map((ch) => {
                const filled = ch.keywords.filter(
                  (kw) => kw.description && kw.referencePoints,
                ).length;
                return (
                  <div key={ch.id}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="badge badge-brand">第 {ch.index} 章</span>
                      <span className="text-sm font-semibold text-ink">{ch.title}</span>
                      <span className="text-xs font-medium text-muted">
                        {filled}/{ch.keywords.length} 词已补全
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                      {ch.keywords.map((kw) => (
                        <KeywordEditor
                          key={kw.id}
                          keywordId={kw.id}
                          term={kw.term}
                          description={kw.description ?? ""}
                          referencePoints={kw.referencePoints ?? ""}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
