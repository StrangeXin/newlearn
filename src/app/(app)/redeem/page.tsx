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
  PENDING: { text: "待审批", cls: "badge badge-muted" },
  APPROVED: { text: "已通过", cls: "badge badge-success" },
  REJECTED: { text: "已驳回", cls: "badge badge-danger" },
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

  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  });
  const approvedTotal = redemptions
    .filter((r) => r.status === "APPROVED")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <main className="page-narrow py-8">
      <div className="animate-float-in">
        <h1 className="text-2xl font-extrabold text-ink">积分兑换</h1>
        <p className="mt-1 text-sm text-muted">
          1 积分 = 1 元，可多次兑换书或工具。
        </p>
      </div>

      {/* 余额是这页的情绪点：金色聚焦「可用」，旁边给出总分与占用的来龙去脉 */}
      <div className="animate-float-in mt-5 rounded-xl border border-line bg-accent-100 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tabular-nums text-accent-700">
              {available}
            </span>
            <span className="text-sm font-semibold text-accent-700">积分可用</span>
          </div>
          <p className="mt-1 text-sm text-ink">
            约合 <span className="font-semibold">{available} 元</span>{" "}
            报销额度。
          </p>
        </div>
        <dl className="mt-4 flex gap-6 sm:mt-0 sm:shrink-0">
          <div>
            <dt className="text-xs font-medium text-accent-700">累计积分</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{balance}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-accent-700">待审批占用</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{pending}</dd>
          </div>
        </dl>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="font-bold text-ink">发起兑换</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          提交后由管理员审批。审批期间金额冻结，通过后扣分。
        </p>
        <RedeemForm available={available} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-bold text-ink">我的申请</h2>
          {approvedTotal > 0 && (
            <span className="text-xs font-medium text-muted">
              已兑换{" "}
              <span className="font-semibold text-accent-700">{approvedTotal}</span> 元
            </span>
          )}
        </div>
        {redemptions.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-semibold text-ink">还没有兑换记录</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
              上方表单提交后，每笔进度会列在这里。
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {redemptions.map((r) => {
              const s = statusLabel[r.status];
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{r.item}</div>
                    <div className="mt-0.5 text-xs font-medium text-muted">
                      <span className="tabular-nums text-accent-700">{r.amount}</span> 积分
                      <span className="px-1.5 text-line">·</span>
                      {dateFmt.format(r.createdAt)} 提交
                    </div>
                  </div>
                  <span className={`${s.cls} shrink-0`}>{s.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
