import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { isChapterUnlocked } from "@/lib/schedule";
import { getActiveSubjectById } from "@/lib/subject";
import {
  getOrCreateReflection,
  isChapterFullyCompleted,
} from "@/lib/reflection";
import { Markdown } from "@/components/markdown";
import { ReasoningDialog } from "@/components/reasoning-dialog";
import { ReflectForm } from "./reflect-form";

export default async function ReflectPage({
  params,
}: {
  params: Promise<{ subjectId: string; index: string }>;
}) {
  const { subjectId, index } = await params;
  const chapterIndex = Number.parseInt(index, 10);
  const user = await requireUser();

  const subject = await getActiveSubjectById(subjectId);
  if (!subject) redirect("/learn");
  const chapterHref = `/learn/${subject.id}/chapter/${chapterIndex}`;

  const chapter = await prisma.chapter.findFirst({
    where: { subjectId: subject.id, index: chapterIndex },
    include: { subject: { select: { startDate: true } } },
  });
  if (!chapter) notFound();
  if (!isChapterUnlocked(chapter.subject, chapter.index)) redirect("/learn");

  const completed = await isChapterFullyCompleted(user.id, chapter.id);
  if (!completed) {
    return (
      <main className="animate-float-in page-narrow py-8">
        <Link
          href={chapterHref}
          className="text-sm font-medium text-muted transition hover:text-brand-700"
        >
          ← 返回章节
        </Link>
        <div className="card mt-6 flex flex-col items-center px-6 py-14 text-center">
          <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
            🧩
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-ink">章节反思还没解锁</h1>
          <p className="mt-2 max-w-sm leading-relaxed text-muted">
            通关《{chapter.title}》全部 20 个关键词后，会出现一组结合你岗位的反思题。
          </p>
          <Link href={chapterHref} className="btn btn-primary mt-6">
            回到本章继续闯关
          </Link>
        </div>
      </main>
    );
  }

  const reflection = await getOrCreateReflection(user.id, chapter.id);

  return (
    <main className="animate-float-in page-narrow py-8">
      <Link
        href={chapterHref}
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 返回章节
      </Link>
      <div className="mt-3 flex items-start gap-4">
        <span
          className={`map-node h-12 w-12 shrink-0 text-lg ${reflection.done ? "map-node-done" : "map-node-open"}`}
          aria-hidden
        >
          {reflection.done ? "✓" : "🧩"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-brand-700">
            第 {chapter.index} 关 · 章节反思
          </div>
          <h1 className="mt-0.5 text-2xl font-extrabold text-ink">{chapter.title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            20 个关键词已通关。结合你岗位回答下面几题，提交后会给一份本章小结。
          </p>
        </div>
      </div>

      {reflection.done ? (
        <>
          <div className="card mt-6 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-success">✓ 反思已完成</span>
              <h2 className="font-bold text-ink">AI 给你的本章小结</h2>
              {reflection.reasoning && (
                <span className="ml-auto">
                  <ReasoningDialog
                    reasoning={reflection.reasoning}
                    title="AI 章节小结的思考过程"
                    summary="这是 DeepSeek 结合你的反思作答与岗位，生成本章小结前的完整推理。"
                  />
                </span>
              )}
            </div>
            <div className="panel mt-4 p-4">
              <Markdown>{reflection.summary}</Markdown>
            </div>
          </div>

          <h2 className="mt-7 text-sm font-semibold text-muted">你的逐题作答</h2>
          <div className="mt-3 space-y-2.5">
            {reflection.questions.map((q, i) => (
              <details key={i} className="card px-4 py-3 [&[open]>summary>.rc]:rotate-180">
                <summary className="flex cursor-pointer list-none items-start gap-2 text-sm font-medium text-ink">
                  <span className="text-brand-700">{i + 1}.</span>
                  <span className="flex-1">{q}</span>
                  <span className="rc shrink-0 text-xs text-muted transition-transform" aria-hidden>
                    ▾
                  </span>
                </summary>
                <p className="mt-2.5 whitespace-pre-wrap border-t border-line pt-2.5 text-sm leading-relaxed text-muted">
                  {reflection.answers[i] || "（未作答）"}
                </p>
              </details>
            ))}
          </div>

          <div className="panel mt-6 flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <div className="font-bold text-ink">画像已根据这次反思更新</div>
              <p className="mt-0.5 text-sm text-muted">
                去成长轨迹看最新画像。
              </p>
            </div>
            <Link href="/growth" className="btn btn-primary btn-sm shrink-0">
              看成长轨迹 →
            </Link>
          </div>
        </>
      ) : (
        <div className="card mt-6 p-5 sm:p-6">
          <ReflectForm chapterId={chapter.id} questions={reflection.questions} />
        </div>
      )}
    </main>
  );
}
