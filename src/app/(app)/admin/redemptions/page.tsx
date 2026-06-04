import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { RowActions } from "./row-actions";

const statusLabel: Record<string, { text: string; cls: string }> = {
  APPROVED: { text: "已通过", cls: "bg-success-500/15 text-success-500" },
  REJECTED: { text: "已驳回", cls: "bg-danger-500/15 text-danger-500" },
};

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">兑换审批</h1>

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">
          待审批 <span className="text-sm font-normal text-muted">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">没有待审批的申请。</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white/90 px-4 py-3 shadow-sm"
              >
                <div>
                  <div className="font-medium text-ink">
                    {r.user.name} · {r.item}
                  </div>
                  <div className="text-xs text-muted">
                    {r.amount} 元
                    {r.attachment && (
                      <>
                        {" · "}
                        <a href={r.attachment} className="text-brand-700 underline" target="_blank" rel="noreferrer">
                          凭证
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <RowActions id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-bold text-ink">最近处理</h2>
        {processed.length === 0 ? (
          <p className="text-sm text-muted">暂无记录。</p>
        ) : (
          <ul className="space-y-2">
            {processed.map((r) => {
              const s = statusLabel[r.status];
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-brand-100 bg-white/60 px-4 py-2.5 text-sm"
                >
                  <span className="text-ink">
                    {r.user.name} · {r.item} · {r.amount} 元
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                    {s.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
