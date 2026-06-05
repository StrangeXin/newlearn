import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { RowActions } from "./row-actions";

const statusLabel: Record<string, { text: string; cls: string }> = {
  APPROVED: { text: "✓ 已通过", cls: "badge-success" },
  REJECTED: { text: "已驳回", cls: "badge-danger" },
};

const dateFmt = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminRedemptionsPage() {
  await requireAdmin();

  const [pending, processed] = await Promise.all([
    prisma.redemption.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.redemption.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } }, reviewedBy: { select: { name: true } } },
    }),
  ]);

  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);

  return (
    <main className="page py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">兑换审批</h1>
          <p className="mt-1.5 text-sm text-muted">
            员工申请的积分兑换在这里审批。通过后按 1 积分=1 元从其当前学科积分扣减，驳回不扣分。
          </p>
        </div>
        {pending.length > 0 && (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-2 text-right">
            <div className="text-lg font-bold tabular-nums text-ink">
              {pendingTotal} <span className="text-sm font-semibold text-muted">元待审</span>
            </div>
            <div className="text-xs text-muted">
              共 <span className="tabular-nums">{pending.length}</span> 笔
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
            待审批
            {pending.length > 0 && (
              <span className="badge badge-brand tabular-nums">{pending.length}</span>
            )}
          </h2>
          {pending.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-10 text-center">
              <span className="text-2xl" aria-hidden>
                ✓
              </span>
              <p className="mt-2 text-sm font-medium text-ink">待审批已清空</p>
              <p className="mt-1 max-w-xs text-xs text-muted">
                员工在「兑换积分」提交申请后会排到这里，按提交先后处理。
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="card px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{r.user.name}</div>
                      <div className="mt-0.5 truncate text-sm text-muted">{r.item}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums text-ink">
                        {r.amount} <span className="text-xs font-semibold text-muted">元</span>
                      </div>
                      <div className="text-xs text-muted">{dateFmt.format(r.createdAt)} 提交</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                    {r.attachment ? (
                      <a
                        href={r.attachment}
                        className="text-sm font-medium text-brand-700 underline underline-offset-2 transition hover:text-brand-600"
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看凭证 ↗
                      </a>
                    ) : (
                      <span className="text-xs text-muted">未附凭证</span>
                    )}
                    <RowActions id={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-bold text-ink">最近处理</h2>
          {processed.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink">还没有处理记录</p>
              <p className="mt-1 max-w-xs text-xs text-muted">
                通过或驳回的申请会留在这里，最近 20 条可查，便于核对扣分。
              </p>
            </div>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {processed.map((r) => {
                const s = statusLabel[r.status];
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">
                        <span className="font-medium">{r.user.name}</span> · {r.item}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        <span className="tabular-nums">{r.amount}</span> 元
                        {r.reviewedBy && <> · {r.reviewedBy.name} 处理</>}
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${s.cls}`}>{s.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
