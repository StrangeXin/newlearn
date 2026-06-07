import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { PASS_THRESHOLD } from "@/lib/scoring";
import { DAILY_COMPLETION_LIMIT, countTodayCompletions } from "@/lib/learn";
import { isChapterUnlocked } from "@/lib/schedule";
import { isChapterFullyCompleted } from "@/lib/reflection";
import { getKeywordStat, getPeerNotes } from "@/lib/social";
import { ExpandableText } from "@/components/expandable-text";
import { Markdown } from "@/components/markdown";
import { NoteForm } from "./note-form";
import { FollowupsForm } from "./followups-form";
import { ScoreReveal } from "./score-reveal";
import { RecordView } from "./record-view";
import { AskForm } from "./ask-form";
import { ReasoningDialog } from "@/components/reasoning-dialog";
import {
  KeywordNoteIllustration,
  shouldShowKeywordNoteIllustration,
} from "./keyword-note-illustration";

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

  const [progress, history] = await Promise.all([
    prisma.keywordProgress.findUnique({
      where: { userId_keywordId: { userId: user.id, keywordId: id } },
    }),
    prisma.submission.findMany({
      where: { userId: user.id, keywordId: id },
      orderBy: { createdAt: "desc" },
      include: {
        scoring: { include: { followups: { orderBy: { order: "asc" } } } },
        questions: { orderBy: { order: "asc" } },
      },
    }),
  ]);
  const latest = history[0] ?? null;

  const step =
    latest?.status === "AWAITING_ANSWERS" && latest.scoring
      ? "answer"
      : latest?.status === "COMPLETED" && !wantNew
        ? "result"
        : "note";

  // 中途退出保留记录：写笔记这一步预填上次草稿；并算今日完成数（每天限完成 10 个）
  const [draft, todayDone] =
    step === "note"
      ? await Promise.all([
          prisma.noteDraft.findUnique({
            where: { userId_keywordId: { userId: user.id, keywordId: id } },
          }),
          countTodayCompletions(user.id),
        ])
      : [null, 0];
  // 未完成的新词，今日达上限则不能再开（重刷已完成的词不受限）
  const dailyLimitReached = !progress?.isCompleted && todayDone >= DAILY_COMPLETION_LIMIT;

  // 全部已完成的答题记录（最新在前）；归档区展示
  const completed = history.filter((s) => s.status === "COMPLETED" && s.scoring);

  const backHref = `/learn/${keyword.chapter.subjectId}/chapter/${keyword.chapter.index}`;
  const peerNotes = progress?.isCompleted ? await getPeerNotes(user.id, id) : null;
  const keywordStat =
    progress?.isCompleted ? await getKeywordStat(id, progress.bestFinalScore) : null;

  // 整章 20 词全部通关后，提示去做章节反思（反思是上排行榜的前提）
  let needReflection = false;
  if (step === "result" && progress?.isCompleted) {
    const chapterDone = await isChapterFullyCompleted(user.id, keyword.chapterId);
    if (chapterDone) {
      const refl = await prisma.chapterReflection.findUnique({
        where: { userId_chapterId: { userId: user.id, chapterId: keyword.chapterId } },
        select: { summary: true },
      });
      needReflection = !refl?.summary;
    }
  }

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

      {step === "note" && !dailyLimitReached && shouldShowKeywordNoteIllustration(keyword.term) && (
        <div className="mt-5">
          <KeywordNoteIllustration
            term={keyword.term}
            description={keyword.description}
            referencePoints={keyword.referencePoints}
          />
        </div>
      )}

      <div className="card mt-6 p-6">
        {step === "note" &&
          (dailyLimitReached ? (
            <div className="flex flex-col items-center px-2 py-8 text-center">
              <span className="map-node map-node-locked h-14 w-14 text-2xl" aria-hidden>
                ✓
              </span>
              <h2 className="mt-5 text-lg font-bold text-ink">今天已完成 {DAILY_COMPLETION_LIMIT} 个关键词</h2>
              <p className="mt-2 max-w-sm text-sm text-muted">
                每天最多完成 {DAILY_COMPLETION_LIMIT} 个，明天再来继续闯关。已完成的词随时能重刷高分。
              </p>
              <Link href={backHref} className="btn btn-primary mt-6">
                返回章节
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-3 font-bold text-ink">
                {progress ? "再写一版，刷个更高分" : "写下你的学习笔记"}
              </h2>
              {progress ? (
                <p className="mb-3 text-sm text-muted">
                  目前最高 {progress.bestFinalScore} 分，多次提交只取最高分。
                </p>
              ) : (
                <p className="mb-3 text-sm text-muted">
                  今天已完成 {todayDone} / {DAILY_COMPLETION_LIMIT} 个关键词。
                </p>
              )}
              {draft && (
                <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
                  已恢复上次中途保存的草稿，可继续写。
                </p>
              )}
              <NoteForm keywordId={id} initialNote={draft?.text ?? ""} />
            </>
          ))}

        {step === "answer" && latest?.scoring && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50 px-4 py-3">
              <span className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-brand-700">AI 初评</span>
                <span className="text-2xl font-extrabold tabular-nums text-brand-700">
                  {latest.scoring.initialScore}
                </span>
                <span className="text-sm text-brand-700">分</span>
              </span>
              <span className="text-sm text-muted">答完下面的追问，最终分还能往上走</span>
              {latest.scoring.initialReasoning && (
                <span className="ml-auto">
                  <ReasoningDialog
                    reasoning={latest.scoring.initialReasoning}
                    title="AI 初评的思考过程"
                    summary={`初评 ${latest.scoring.initialScore} 分。这是 DeepSeek 给分前的完整推理，仅供参考。`}
                  />
                </span>
              )}
            </div>
            {/* 答追问时仍能对照自己刚写的笔记，不丢上下文（与答题记录里的笔记同款展示） */}
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold text-muted">你的笔记</div>
              <div className="rounded-xl bg-surface-2 p-3">
                <ExpandableText text={latest.noteText} markdown />
              </div>
            </div>
            <FollowupsForm
              submissionId={latest.id}
              followups={latest.scoring.followups.map((f) => ({ id: f.id, question: f.question }))}
              initialAnswers={latest.scoring.followups.map((f) => f.answer ?? "")}
            />
          </>
        )}

        {step === "result" && latest?.scoring && (
          <div className="text-center">
            <div className="text-sm text-muted">最终得分</div>
            <ScoreReveal value={latest.finalScore ?? 0} passed={latest.isPassed} />
            {latest.scoring.finalReasoning && (
              <div className="mt-2 flex justify-center">
                <ReasoningDialog
                  reasoning={latest.scoring.finalReasoning}
                  title="AI 终评的思考过程"
                  summary={`终评 ${latest.finalScore} 分。这是 DeepSeek 综合笔记与追问回答后给分的完整推理。`}
                />
              </div>
            )}
            <p className="mt-2 font-semibold text-ink">
              {latest.isPassed
                ? progress?.bestFinalScore === latest.finalScore
                  ? "已通过，获得 1 积分"
                  : `已通过。本次没超过历史最高 ${progress?.bestFinalScore}，积分之前已计过`
                : `未达 ${PASS_THRESHOLD} 分，改完可以再交，只取最高分`}
            </p>
            {needReflection && (
              <Link
                href={`${backHref}/reflect`}
                className="mx-auto mt-5 block max-w-prose rounded-2xl bg-brand-600 p-5 text-left text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                <div className="text-sm font-medium text-white/85">🎉 本章 20 词全部通关！</div>
                <div className="mt-1 text-lg font-extrabold">最后一步：完成「章节反思」</div>
                <p className="mt-1 text-sm leading-relaxed text-white/85">
                  做完反思才能参与本章周冠军结算（前 3 名 +100 积分），也会据此更新你的成长画像。
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand-700">
                  去完成反思 →
                </span>
              </Link>
            )}
            {latest.scoring.feedback && (
              <div className="mx-auto mt-4 max-w-prose rounded-xl bg-brand-50 p-3.5 text-left">
                <Markdown>{latest.scoring.feedback}</Markdown>
              </div>
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

            {/* 本次完整答题记录 */}
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="mb-3 text-left text-sm font-semibold text-ink">本次答题记录</h3>
              <RecordView submission={latest} />
            </div>

            {/* 向 AI 追问：结合本次笔记/追问/岗位作答，流式输出，可多次，追加在下面 */}
            <div className="mt-6 border-t border-line pt-5 text-left">
              <h3 className="text-sm font-semibold text-ink">向 AI 追问</h3>
              <p className="mb-3 mt-0.5 text-xs text-muted">
                还有疑问就问 AI，它会结合你这次的笔记、追问与岗位来答。
              </p>
              <AskForm
                submissionId={latest.id}
                initialQA={latest.questions.map((q) => ({
                  question: q.question,
                  answer: q.answer,
                  reasoning: q.reasoning ?? "",
                }))}
              />
            </div>
          </div>
        )}
      </div>

      {/* 全部答题记录归档（多次重提时可逐次回看） */}
      {completed.length > (step === "result" ? 1 : 0) && (
        <section className="mt-8">
          <h2 className="font-bold text-ink">我的答题记录</h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            这个词你一共提交过 {completed.length} 次，点开任意一次看完整笔记与追问回答。
          </p>
          <ul className="space-y-2.5">
            {completed.map((s, i) => (
              <li key={s.id} className="card overflow-hidden">
                <details
                  open={step !== "result" && i === 0}
                  className="[&[open]>summary>.rec-caret]:rotate-180"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-ink">第 {completed.length - i} 次提交</span>
                      <span
                        className={`badge ${s.isPassed ? "badge-success" : "badge-muted"}`}
                      >
                        {s.finalScore} 分
                      </span>
                    </span>
                    <span className="rec-caret text-xs text-muted transition-transform" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="border-t border-line px-4 py-4">
                    <RecordView submission={s} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 同伴可见性：完成本词后才出现本区（peerNotes 非 null 即已完成）。
          没有其他同事完成时显示空态，待他人完成后刷新即出现真实笔记。 */}
      {peerNotes !== null && (
        <section className="mt-8">
          <h2 className="font-bold text-ink">同事怎么写的</h2>
          <p className="mb-3 mt-1 text-xs text-muted">
            完成本词后可见，展示得分最高的 3 位。
          </p>
          {peerNotes.length === 0 ? (
            <div className="card px-5 py-8 text-center text-sm text-muted">
              还没有其他同事完成这个词。等大家陆续完成后，他们的笔记会按得分高低出现在这里。
            </div>
          ) : (
            <ul className="space-y-3">
              {peerNotes.map((p, i) => (
                <li key={i} className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{p.name}</span>
                    <span className="badge badge-brand">{p.score} 分</span>
                  </div>
                  <div className="mb-1 text-xs font-semibold text-muted">笔记</div>
                  <div className="rounded-xl bg-surface-2 p-3">
                    <ExpandableText text={p.note} markdown />
                  </div>
                  {p.followups.length > 0 && (
                    <div className="mt-3 space-y-2.5">
                      <div className="text-xs font-semibold text-muted">追问与回答</div>
                      {p.followups.map((f, j) => (
                        <div key={j} className="rounded-xl border border-line p-3">
                          <p className="text-sm font-medium text-ink">
                            <span className="badge badge-brand mr-2">追问 {j + 1}</span>
                            {f.question}
                          </p>
                          <div className="mt-1.5">
                            <ExpandableText
                              text={f.answer.trim() ? f.answer : "（未作答）"}
                              className="text-muted"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
