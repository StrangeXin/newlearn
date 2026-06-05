import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { PASS_THRESHOLD } from "@/lib/scoring";
import { isChapterUnlocked } from "@/lib/schedule";
import { getKeywordStat, getPeerNotes } from "@/lib/social";
import { NoteForm } from "./note-form";
import { FollowupsForm } from "./followups-form";
import { ScoreReveal } from "./score-reveal";

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
  const keywordStat =
    progress?.isCompleted ? await getKeywordStat(id, progress.bestFinalScore) : null;

  return (
    <main className="page-narrow py-8">
      <Link
        href={backHref}
        className="text-sm font-medium text-muted transition hover:text-brand-700"
      >
        ← 返回《{keyword.chapter.title}》
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{keyword.term}</h1>
          {keyword.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{keyword.description}</p>
          )}
        </div>
        {progress?.isCompleted && (
          <span className="badge badge-success shrink-0 px-3 py-1 text-sm">
            ✓ 已通过 {progress.bestFinalScore}
          </span>
        )}
      </div>

      <div className="card mt-6 p-6">
        {step === "note" && (
          <>
            <h2 className="mb-3 font-bold text-ink">
              {progress ? "再写一版，刷个更高分" : "写下你的学习笔记"}
            </h2>
            {progress && (
              <p className="mb-3 text-sm text-muted">
                目前最高 {progress.bestFinalScore} 分，多次提交只取最高分。
              </p>
            )}
            <NoteForm keywordId={id} />
          </>
        )}

        {step === "answer" && latest?.scoring && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="badge badge-brand px-3 py-1 text-sm">
                初评 {latest.scoring.initialScore} 分
              </span>
              <span className="text-sm text-muted">回答下面的追问，看最终分</span>
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
            <ScoreReveal value={latest.finalScore ?? 0} passed={latest.isPassed} />
            <p className="mt-2 font-semibold text-ink">
              {latest.isPassed
                ? progress?.bestFinalScore === latest.finalScore
                  ? "已通过，获得 1 积分"
                  : `已通过。本次没超过历史最高 ${progress?.bestFinalScore}，积分之前已计过`
                : `未达 ${PASS_THRESHOLD} 分，改完可以再交，只取最高分`}
            </p>
            {latest.scoring.feedback && (
              <p className="mx-auto mt-4 max-w-prose rounded-xl bg-brand-50 p-3.5 text-left text-sm leading-relaxed text-ink">
                {latest.scoring.feedback}
              </p>
            )}
            {keywordStat && (
              <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink">
                本词全员均分 <span className="font-bold text-brand-700">{keywordStat.avg}</span>（{keywordStat.count} 人完成）·
                你超过了 <span className="font-bold text-accent-700">{keywordStat.beatPct}%</span> 的人
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              画像已根据本次作答更新 ·{" "}
              <Link href="/growth" className="font-medium text-brand-700 underline underline-offset-2">
                看成长轨迹
              </Link>
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href={`/learn/keyword/${id}?new=1`} className="btn btn-secondary">
                再来一版
              </Link>
              <Link href={backHref} className="btn btn-primary">
                返回章节
              </Link>
            </div>
          </div>
        )}
      </div>

      {peerNotes && peerNotes.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold text-ink">同事怎么写的</h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            完成本词后可见，按得分高低排列。
          </p>
          <ul className="space-y-2.5">
            {peerNotes.map((p, i) => (
              <li key={i} className="card p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{p.name}</span>
                  <span className="badge badge-brand">{p.score} 分</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{p.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
