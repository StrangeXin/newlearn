import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { isChapterUnlocked } from "@/lib/schedule";
import {
  getOrCreateReflection,
  isChapterFullyCompleted,
} from "@/lib/reflection";
import { ReflectForm } from "./reflect-form";

export default async function ReflectPage({
  params,
}: {
  params: Promise<{ index: string }>;
}) {
  const { index } = await params;
  const chapterIndex = Number.parseInt(index, 10);
  const user = await requireUser();

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    select: { activeSubjectId: true },
  });
  if (!cfg?.activeSubjectId) redirect("/learn");
  const chapter = await prisma.chapter.findFirst({
    where: { subjectId: cfg.activeSubjectId, index: chapterIndex },
    include: { subject: { select: { startDate: true } } },
  });
  if (!chapter) notFound();
  if (!isChapterUnlocked(chapter.subject, chapter.index)) redirect("/learn");

  const completed = await isChapterFullyCompleted(user.id, chapter.id);
  if (!completed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Link href={`/learn/chapter/${chapter.index}`} className="text-sm text-muted hover:text-brand-700">
          ← 返回章节
        </Link>
        <div className="mt-8 text-4xl">🧩</div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">先通关本章全部关键词</h1>
        <p className="mt-2 text-muted">完成《{chapter.title}》的全部关键词后，才能做章节反思。</p>
      </main>
    );
  }

  const reflection = await getOrCreateReflection(user.id, chapter.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/learn/chapter/${chapter.index}`} className="text-sm text-muted hover:text-brand-700">
        ← 返回章节
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">章节反思 · {chapter.title}</h1>
      <p className="mt-1 text-sm text-muted">
        把本章学到的，结合你的岗位和实际工作想一想——这一步帮你真正用起来。
      </p>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-sm">
        {reflection.done ? (
          <div>
            <div className="mb-3 text-2xl">✅</div>
            <h2 className="font-bold text-ink">本章反思已完成</h2>
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-brand-50 p-3 text-sm text-ink">
              {reflection.summary}
            </p>
            <div className="mt-4 space-y-2">
              {reflection.questions.map((q, i) => (
                <details key={i} className="rounded-xl border border-brand-100 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-ink">{q}</summary>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                    {reflection.answers[i] || "（未作答）"}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              AI 已据本次反思丰富了你的画像 ·{" "}
              <Link href="/growth" className="text-brand-700 underline">
                看成长轨迹
              </Link>
            </p>
          </div>
        ) : (
          <ReflectForm
            chapterId={chapter.id}
            chapterIndex={chapter.index}
            questions={reflection.questions}
          />
        )}
      </div>
    </main>
  );
}
