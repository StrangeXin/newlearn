import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import {
  getAvailableBalance,
  getPendingRedeemTotal,
  getSubjectBalance,
} from "@/lib/redemption";
import { RedeemForm } from "./redeem-form";

const statusLabel: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "待审批", cls: "bg-accent-500/15 text-accent-500" },
  APPROVED: { text: "已通过", cls: "bg-success-500/15 text-success-500" },
  REJECTED: { text: "已驳回", cls: "bg-danger-500/15 text-danger-500" },
};

export default async function RedeemPage() {
  const user = await requireUser();
  if (user.role !== "EMPLOYEE") redirect("/admin");

  const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const cfg = await prisma.activeSubjectConfig.findUnique({
    where: { singletonId: "GLOBAL" },
    include: { activeSubject: true },
  });
  if (!cfg?.activeSubjectId) redirect("/learn");
  const subjectId = cfg.activeSubjectId;

  const [balance, pending, available, redemptions] = await Promise.all([
    getSubjectBalance(user.id, subjectId),
    getPendingRedeemTotal(user.id, subjectId),
    getAvailableBalance(user.id, subjectId),
    prisma.redemption.findMany({
      where: { userId: user.id, subjectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-ink">积分兑换</h1>
      <p className="mt-1 text-sm text-muted">
        1 积分 = 1 元，可多次部分兑换书籍或工具。学科：{cfg.activeSubject?.title}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
          <div className="text-2xl font-extrabold text-brand-700">{balance}</div>
          <div className="text-xs text-muted">总积分</div>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
          <div className="text-2xl font-extrabold text-accent-500">{pending}</div>
          <div className="text-xs text-muted">待审批占用</div>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white/80 p-4 text-center">
          <div className="text-2xl font-extrabold text-success-500">{available}</div>
          <div className="text-xs text-muted">可用</div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-brand-100 bg-white/90 p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-ink">发起兑换</h2>
        <RedeemForm available={available} />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-ink">我的申请</h2>
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted">还没有兑换记录。</p>
        ) : (
          <ul className="space-y-2">
            {redemptions.map((r) => {
              const s = statusLabel[r.status];
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-brand-100 bg-white/80 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-ink">{r.item}</div>
                    <div className="text-xs text-muted">{r.amount} 元</div>
                  </div>
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
