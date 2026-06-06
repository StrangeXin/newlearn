import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";

const PHASE: Record<string, string> = {
  submitNote: "提交笔记 · 初评",
  finalize: "追问回答 · 终评",
  updateMemory: "画像更新",
  reflectionQuestions: "章节反思 · 出题",
  reflectionSummary: "章节反思 · 总结",
  answerQuestion: "结果页追问",
};

const fmt = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const dayFmt = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const TAKE = 80;

/** 千分位格式化，空值按 0。 */
const n = (x: number | null | undefined) => (x ?? 0).toLocaleString("zh-CN");

function Stat({
  label,
  value,
  unit,
  tone = "ink",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "ink" | "brand" | "danger";
}) {
  const color =
    tone === "brand" ? "text-brand-700" : tone === "danger" ? "text-danger-600" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div className={`text-xl font-extrabold tabular-nums ${color}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-bold text-muted">{unit}</span>}
      </div>
      <div className="mt-0.5 text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

/** 统计明细行：标签 + 次数/token + 占比条。 */
function BarRow({
  label,
  calls,
  tokens,
  pct,
}: {
  label: string;
  calls: number;
  tokens: number;
  pct: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-ink">{label}</span>
        <span className="shrink-0 tabular-nums text-muted">
          {n(calls)} 次 · <span className="font-semibold text-ink">{n(tokens)}</span> token
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">
        {title} <span className="font-normal text-muted/70">· {body.length} 字</span>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-ink">
        {body}
      </pre>
    </div>
  );
}

export default async function AdminAiLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  await requireAdmin();
  const { phase } = await searchParams;
  const where = phase && PHASE[phase] ? { phase } : {};

  const [logs, agg, failures, phaseStats, byDay] = await Promise.all([
    prisma.aiCallLog.findMany({ where, orderBy: { createdAt: "desc" }, take: TAKE }),
    prisma.aiCallLog.aggregate({
      _count: { _all: true },
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
        reasoningTokens: true,
      },
    }),
    prisma.aiCallLog.count({ where: { ok: false } }),
    prisma.aiCallLog.groupBy({
      by: ["phase"],
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
    prisma.$queryRaw<Array<{ day: Date; calls: number; tokens: number }>>`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*)::int AS calls,
             COALESCE(SUM("totalTokens"), 0)::int AS tokens
      FROM ai_call_logs
      GROUP BY day
      ORDER BY day DESC
      LIMIT 14`,
  ]);
  const total = agg._count._all;

  // 按调用类型：已知阶段（保持顺序、含 0）+ 未知阶段补在后面
  const phaseRows = Object.keys(PHASE).map((key) => {
    const r = phaseStats.find((p) => p.phase === key);
    return { key, label: PHASE[key], calls: r?._count._all ?? 0, tokens: r?._sum.totalTokens ?? 0 };
  });
  for (const p of phaseStats) {
    if (!PHASE[p.phase]) {
      phaseRows.push({
        key: p.phase,
        label: p.phase,
        calls: p._count._all,
        tokens: p._sum.totalTokens ?? 0,
      });
    }
  }
  const maxPhaseTok = Math.max(1, ...phaseRows.map((r) => r.tokens));
  const maxDayTok = Math.max(1, ...byDay.map((d) => d.tokens));

  const userIds = [...new Set(logs.map((l) => l.userId).filter((x): x is string => !!x))];
  const chapterIds = [...new Set(logs.map((l) => l.chapterId).filter((x): x is string => !!x))];
  const [users, chapters] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    prisma.chapter.findMany({
      where: { id: { in: chapterIds } },
      select: { id: true, title: true, index: true },
    }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const chapterLabel = new Map(chapters.map((c) => [c.id, `第${c.index}章 ${c.title}`]));

  return (
    <main className="page py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">AI 调用记录</h1>
          <p className="mt-1.5 text-sm text-muted">
            每次 AI 调用的完整上下文（提示词、模型推理、返回与用量），含 token 用量统计。
          </p>
        </div>
      </div>

      {/* 用量统计：总量 + 按类型 + 按日 */}
      {total > 0 && (
        <section className="card mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">用量统计</h2>
            <span className="text-xs text-muted">全部记录累计</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="总调用" value={n(total)} unit="次" />
            <Stat label="总 token" value={n(agg._sum.totalTokens)} tone="brand" />
            <Stat label="输入 token" value={n(agg._sum.promptTokens)} />
            <Stat label="输出 token" value={n(agg._sum.completionTokens)} />
            <Stat label="推理 token" value={n(agg._sum.reasoningTokens)} />
            <Stat label="失败" value={n(failures)} unit="次" tone={failures > 0 ? "danger" : "ink"} />
          </div>

          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted">按调用类型</h3>
              <div className="space-y-3">
                {phaseRows.map((r) => (
                  <BarRow
                    key={r.key}
                    label={r.label}
                    calls={r.calls}
                    tokens={r.tokens}
                    pct={(r.tokens / maxPhaseTok) * 100}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted">按日（近 14 天）</h3>
              {byDay.length === 0 ? (
                <p className="text-sm text-muted">暂无数据</p>
              ) : (
                <div className="space-y-3">
                  {byDay.map((d) => (
                    <BarRow
                      key={d.day.toISOString()}
                      label={dayFmt.format(d.day)}
                      calls={d.calls}
                      tokens={d.tokens}
                      pct={(d.tokens / maxDayTok) * 100}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/ai-logs"
          className={`badge ${!phase ? "badge-brand" : "badge-muted"} px-3 py-1`}
        >
          全部
        </Link>
        {Object.entries(PHASE).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/ai-logs?phase=${key}`}
            className={`badge ${phase === key ? "badge-brand" : "badge-muted"} px-3 py-1`}
          >
            {label}
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="card mt-6 px-6 py-12 text-center text-sm text-muted">
          还没有 AI 调用记录。员工提交笔记、答追问后会出现在这里。
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">
          {logs.map((l) => {
            const who = l.userId ? (userName.get(l.userId) ?? "（已删除用户）") : "—";
            const target =
              l.keywordTerm ?? (l.chapterId ? chapterLabel.get(l.chapterId) : null) ?? "—";
            return (
              <li key={l.id} className="card overflow-hidden">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-surface-2">
                    <span className="text-xs tabular-nums text-muted">{fmt.format(l.createdAt)}</span>
                    <span className="badge badge-brand">{PHASE[l.phase] ?? l.phase}</span>
                    <span className="text-sm font-medium text-ink">{who}</span>
                    <span className="truncate text-sm text-muted">{target}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {l.totalTokens != null && (
                        <span className="text-xs tabular-nums text-muted">{n(l.totalTokens)} token</span>
                      )}
                      {l.latencyMs != null && (
                        <span className="text-xs tabular-nums text-muted">
                          {(l.latencyMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className={`badge ${l.ok ? "badge-success" : "badge-danger"}`}>
                        {l.ok ? "成功" : "失败"}
                      </span>
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-line px-4 py-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>提供方 {l.provider}</span>
                      {l.model && <span>模型 {l.model}</span>}
                      {l.promptTokens != null && <span>输入 {n(l.promptTokens)} token</span>}
                      {l.completionTokens != null && <span>输出 {n(l.completionTokens)} token</span>}
                      {l.reasoningTokens != null && <span>推理 {n(l.reasoningTokens)} token</span>}
                      {l.submissionId && <span>提交 {l.submissionId.slice(0, 8)}</span>}
                    </div>
                    {!l.ok && l.errorText && (
                      <p className="badge-danger rounded-lg px-3 py-2 text-sm font-medium">
                        {l.errorText}
                      </p>
                    )}
                    <Block title="System 提示" body={l.systemPrompt ?? ""} />
                    <Block title="User 提示（含笔记 / 追问 / 学习者档案等上下文）" body={l.userPrompt ?? ""} />
                    <Block title="模型推理过程（reasoning）" body={l.reasoning ?? ""} />
                    <Block title="模型返回" body={l.responseRaw ?? ""} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
