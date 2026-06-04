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
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">学科与内容</h1>

      <section className="mt-5">
        <h2 className="mb-2 font-bold text-ink">学科</h2>
        <div className="mb-3 rounded-2xl border border-brand-100 bg-white/90 p-4">
          <CreateSubjectForm />
          <p className="mt-2 text-xs text-muted">
            新建空学科后，可在下方用 JSON 批量导入「5 章 + 100 词」内容（结构同 prisma/seed-data）。
          </p>
        </div>
        <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white/90">
          {subjects.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink">{s.title}</span>
                  <span className="ml-2 text-xs text-muted">{s._count.chapters} 章</span>
                </div>
                <SetActiveButton subjectId={s.id} active={s.id === activeId} />
              </div>
              {s._count.chapters === 0 && (
                <div className="mt-2">
                  <ImportContentForm subjectId={s.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {activeSubject && (
        <>
          <section className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-4 shadow-sm">
            <h2 className="mb-2 font-bold text-ink">开始日（决定每周解锁）</h2>
            <StartDateForm value={toDateInput(activeSubject.startDate)} />
          </section>

          <section className="mt-6">
            <h2 className="mb-2 font-bold text-ink">关键词内容（{activeSubject.title}）</h2>
            <div className="space-y-4">
              {activeSubject.chapters.map((ch) => (
                <div key={ch.id}>
                  <div className="mb-2 text-sm font-bold text-brand-700">
                    第 {ch.index} 章 · {ch.title}
                  </div>
                  <div className="space-y-1.5">
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
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
