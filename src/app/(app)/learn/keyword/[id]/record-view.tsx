// 一次答题记录的完整展示：笔记 + 每条追问与回答 + 初评/终评 + 反馈。
// 服务端组件，供「本次记录」内联与「全部记录」归档复用。

import { ExpandableText } from "@/components/expandable-text";
import { Markdown } from "@/components/markdown";
import { ReasoningDialog } from "@/components/reasoning-dialog";

const recordDateFmt = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export interface SubmissionRecord {
  id: string;
  noteText: string;
  finalScore: number | null;
  isPassed: boolean;
  createdAt: Date;
  scoring: {
    initialScore: number;
    initialReasoning: string | null;
    finalScore: number | null;
    finalReasoning: string | null;
    feedback: string | null;
    followups: { id: string; question: string; answer: string | null }[];
  } | null;
}

export function RecordView({ submission }: { submission: SubmissionRecord }) {
  const s = submission.scoring;
  return (
    <div className="space-y-4 text-left">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{recordDateFmt.format(submission.createdAt)}</span>
        {s && (
          <span className="badge badge-muted">初评 {s.initialScore}</span>
        )}
        {s?.initialReasoning && (
          <ReasoningDialog
            reasoning={s.initialReasoning}
            title="AI 初评的思考过程"
            summary={`初评 ${s.initialScore} 分。这是 DeepSeek 给分前的完整推理。`}
          />
        )}
        {submission.finalScore !== null && (
          <span className={`badge ${submission.isPassed ? "badge-success" : "badge-danger"}`}>
            终评 {submission.finalScore}
            {submission.isPassed ? " · 通过" : ` · 未达 60`}
          </span>
        )}
        {s?.finalReasoning && (
          <ReasoningDialog
            reasoning={s.finalReasoning}
            title="AI 终评的思考过程"
            summary={`终评 ${submission.finalScore} 分。这是 DeepSeek 综合笔记与追问回答后给分的完整推理。`}
          />
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold text-muted">我的笔记</div>
        <div className="rounded-xl bg-surface-2 p-3">
          <ExpandableText text={submission.noteText} markdown controls={false} />
        </div>
      </div>

      {s && s.followups.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-muted">追问与我的回答</div>
          {s.followups.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-line p-3">
              <p className="text-sm font-medium text-ink">
                <span className="badge badge-brand mr-2">追问 {i + 1}</span>
                {f.question}
              </p>
              <div className="mt-1.5">
                <ExpandableText
                  text={f.answer?.trim() ? f.answer : "（未作答）"}
                  className="text-muted"
                  controls={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {s?.feedback && (
        <div>
          <div className="mb-1 text-xs font-semibold text-muted">AI 反馈</div>
          <div className="rounded-xl bg-brand-50 p-3">
            <Markdown>{s.feedback}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
