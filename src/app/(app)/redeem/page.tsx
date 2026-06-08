import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireProfile } from "@/lib/auth/user";
import {
  getAvailableBalance,
  getPendingRedeemTotal,
  getSubjectBalance,
} from "@/lib/redemption";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";
import { RedeemForm } from "./redeem-form";

const statusLabel: Record<string, { text: string; cls: string }> = {
  PENDING: { text: "待审批", cls: "badge badge-gold" },
  APPROVED: { text: "已通过", cls: "badge badge-success" },
  REJECTED: { text: "已驳回", cls: "badge badge-danger" },
};

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  // 任何角色都可参与学习与兑换；无资料先去 onboarding（PRD §15.5）
  const { user } = await requireProfile();

  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/learn");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];
  const subjectId = subject.id;

  const [balance, pending, available, redemptions] = await Promise.all([
    getSubjectBalance(user.id, subjectId),
    getPendingRedeemTotal(user.id, subjectId),
    getAvailableBalance(user.id, subjectId),
    prisma.redemption.findMany({
      where: { userId: user.id, subjectId },
      orderBy: { createdAt: "desc" },
      include: { attachmentFile: { select: { id: true } } },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  });
  const approvedTotal = redemptions
    .filter((r) => r.status === "APPROVED")
    .reduce((s, r) => s + r.amount, 0);
  const pendingCount = redemptions.filter((r) => r.status === "PENDING").length;

  return (
    <main className="page py-8">
      <SubjectTabs subjects={subjects} activeId={subjectId} basePath="/redeem" />
      <div className="animate-float-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">积分兑换</h1>
          <p className="mt-1.5 text-sm text-muted">
            1 积分 = 1 元，可多次兑换书、工具或学习服务。
          </p>
        </div>
        {subjects.length > 1 && (
          <div className="rounded-xl border border-line bg-surface px-4 py-2.5 text-right">
            <div className="text-xs font-medium text-muted">当前学科</div>
            <div className="font-semibold text-ink">{subject.title}</div>
          </div>
        )}
      </div>

      <section className="animate-float-in mt-6 overflow-hidden rounded-2xl border border-accent-400/60 bg-surface">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
          <div className="bg-accent-100 px-5 py-5 sm:px-6">
            <div className="text-sm font-semibold text-accent-700">当前可兑换额度</div>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-5xl font-extrabold leading-none tabular-nums text-accent-700">
                {available}
              </span>
              <span className="pb-1 text-base font-bold text-accent-700">元</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink">
              申请提交后会先占用额度，管理员通过后正式扣减积分；驳回会释放额度。
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-line border-t border-line bg-surface lg:border-l lg:border-t-0">
            <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
              <dt className="text-xs font-medium text-muted">累计积分</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{balance}</dd>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
              <dt className="text-xs font-medium text-muted">待审占用</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">{pending}</dd>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-5 text-center">
              <dt className="text-xs font-medium text-muted">已兑换</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                {approvedTotal}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <section className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">发起兑换</h2>
              <p className="mt-1 text-sm text-muted">填写用途与金额，凭证可后续补充说明。</p>
            </div>
            <span className="badge badge-gold shrink-0">可用 {available}</span>
          </div>
          <RedeemForm available={available} subjectId={subjectId} />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">我的申请</h2>
              <p className="mt-1 text-sm text-muted">查看每笔兑换的审批状态和凭证。</p>
            </div>
            {redemptions.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-medium text-muted">
                {pendingCount > 0 && (
                  <span className="badge badge-gold tabular-nums">{pendingCount} 笔待审</span>
                )}
                {approvedTotal > 0 && (
                  <span className="rounded-full border border-line bg-surface px-3 py-1.5">
                    已兑换 <span className="font-semibold text-accent-700">{approvedTotal}</span>{" "}
                    元
                  </span>
                )}
              </div>
            )}
          </div>

          {redemptions.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-xl font-extrabold text-accent-700"
                aria-hidden
              >
                ¥
              </div>
              <p className="mt-4 text-sm font-semibold text-ink">还没有兑换记录</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                通关关键词获得积分后，就可以在上方提交兑换申请。
              </p>
              <Link href="/learn" className="btn btn-secondary mt-5">
                去继续闯关
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {redemptions.map((r) => {
                const s = statusLabel[r.status];
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-line bg-surface px-4 py-4 transition hover:border-brand-200 hover:bg-surface-2/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-ink">{r.item}</h3>
                          <span className={s.cls}>{s.text}</span>
                        </div>
                        <div className="mt-1.5 text-xs font-medium text-muted">
                          {dateFmt.format(r.createdAt)} 提交
                          {r.attachmentFile && (
                            <>
                              <span className="px-1.5 text-line">·</span>
                              <a
                                href={`/api/redemptions/${r.id}/attachment`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-brand-700 underline underline-offset-2 transition hover:text-brand-600"
                              >
                                查看凭证 ↗
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-extrabold tabular-nums text-accent-700">
                          {r.amount}
                        </div>
                        <div className="text-xs font-medium text-muted">积分</div>
                      </div>
                    </div>
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
