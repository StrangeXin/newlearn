import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { PASS_THRESHOLD } from "@/lib/scoring";
import { isChapterUnlocked } from "@/lib/schedule";
import { getPeerNotes } from "@/lib/social";
import { NoteForm } from "./note-form";
import { FollowupsForm } from "./followups-form";

export default async function KeywordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: wantNew } = await searchParams;
  const user = await requireUser();

  const keyword = await prisma.keyword.findUnique({
    where: { id },
    include: { chapter: { include: { subject: { select: { startDate: true } } } } },
  });
  if (!keyword) notFound();
  if (!isChapterUnlocked(keyword.chapter.subject, keyword.chapter.index)) {
    redirect("/learn");
  }

  if (user.role === "EMPLOYEE") {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) redirect("/onboarding");
  }

  const [progress, latest] = await Promise.all([
    prisma.keywordProgress.findUnique({
      where: { userId_keywordId: { userId: user.id, keywordId: id } },
    }),
    prisma.submission.findFirst({
      where: { userId: user.id, keywordId: id },
      orderBy: { createdAt: "desc" },
      include: { scoring: { include: { followups: { orderBy: { order: "asc" } } } } },
    }),
  ]);

  const step =
    latest?.status === "AWAITING_ANSWERS" && latest.scoring
      ? "answer"
      : latest?.status === "COMPLETED" && !wantNew
        ? "result"
        : "note";

  const backHref = `/learn/chapter/${keyword.chapter.index}`;
  const peerNotes = progress?.isCompleted ? await getPeerNotes(user.id, id) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href={backHref} className="text-sm text-muted transition hover:text-brand-700">
        ← 返回《{keyword.chapter.title}》
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{keyword.term}</h1>
          {keyword.description && (
            <p className="mt-2 text-sm text-muted">{keyword.description}</p>
          )}
        </div>
        {progress?.isCompleted && (
          <span className="shrink-0 rounded-full bg-success-500/15 px-3 py-1 text-sm font-bold text-success-500">
            ✓ 已通过 {progress.bestFinalScore}
          </span>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-sm">
        {step === "note" && (
          <>
            <h2 className="mb-3 font-bold text-ink">
              {progress ? "再写一版，刷新更高分" : "写下你的学习笔记"}
            </h2>
            {progress && (
              <p className="mb-3 text-sm text-muted">
                历史最高分 {progress.bestFinalScore}，系统取最高分。
              </p>
            )}
            <NoteForm keywordId={id} />
          </>
        )}

        {step === "answer" && latest?.scoring && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
                初评 {latest.scoring.initialScore} 分
              </span>
              <span className="text-sm text-muted">回答下面的追问，AI 会给出最终分</span>
            </div>
            <FollowupsForm
              submissionId={latest.id}
              keywordId={id}
              followups={latest.scoring.followups.map((f) => ({ id: f.id, question: f.question }))}
            />
          </>
        )}

        {step === "result" && latest?.scoring && (
          <div className="text-center">
            <div className="text-sm text-muted">最终得分</div>
            <div
              className={`text-5xl font-extrabold ${
                latest.isPassed ? "text-success-500" : "text-accent-500"
              }`}
            >
              {latest.finalScore}
            </div>
            <p className="mt-2 font-semibold text-ink">
              {latest.isPassed
                ? progress?.bestFinalScore === latest.finalScore
                  ? "🎉 通过！已计入 1 积分"
                  : "🎉 通过！（历史最高分更高，已计积分）"
                : `未达及格线 ${PASS_THRESHOLD} 分，再来一版试试`}
            </p>
            {latest.scoring.feedback && (
              <p className="mx-auto mt-3 max-w-prose rounded-xl bg-brand-50 p-3 text-left text-sm text-ink">
                {latest.scoring.feedback}
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              AI 已据本次表现更新了对你的画像 ·{" "}
              <Link href="/growth" className="text-brand-700 underline">
                看成长轨迹
              </Link>
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href={`/learn/keyword/${id}?new=1`}
                className="rounded-xl border border-brand-200 px-5 py-2 font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                再来一次
              </Link>
              <Link
                href={backHref}
                className="rounded-xl bg-brand-600 px-5 py-2 font-semibold text-white transition hover:bg-brand-700"
              >
                返回章节
              </Link>
            </div>
          </div>
        )}
      </div>

      {peerNotes && peerNotes.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 font-bold text-ink">👀 看看别人怎么写的</h2>
          <p className="mb-3 text-xs text-muted">
            你已通过本词，解锁同伴笔记（按分数从高到低），相互学习。
          </p>
          <ul className="space-y-2">
            {peerNotes.map((p, i) => (
              <li key={i} className="rounded-xl border border-brand-100 bg-white/80 p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{p.name}</span>
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                    {p.score} 分
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted">{p.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
