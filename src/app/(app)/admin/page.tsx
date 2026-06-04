import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { getScheduleInfo } from "@/lib/schedule";
import { ScheduleControls } from "./schedule-controls";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [employeeCount, adminCount, keywordCount, activatedCount, pendingRedeems, cfg] =
    await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } } }),
      prisma.keyword.count(),
      prisma.user.count({ where: { isActivated: true } }),
      prisma.redemption.count({ where: { status: "PENDING" } }),
      prisma.activeSubjectConfig.findUnique({
        where: { singletonId: "GLOBAL" },
        include: { activeSubject: true },
      }),
    ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="animate-float-in">
        <h1 className="text-3xl font-extrabold text-ink">管理后台</h1>
        <p className="mt-2 text-muted">
          {admin.name} · 当前学科：
          <span className="font-semibold text-brand-700">
            {cfg?.activeSubject?.title ?? "未开启"}
          </span>
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="员工人数" value={employeeCount} />
        <StatCard label="管理员人数" value={adminCount} />
        <StatCard label="已激活账号" value={activatedCount} />
        <StatCard label="关键词总数" value={keywordCount} />
      </div>

      {cfg?.activeSubject && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm">
          <div>
            <div className="font-bold text-ink">
              周期：第 {getScheduleInfo(cfg.activeSubject).currentWeek} 周
              <span className="ml-2 text-xs font-normal text-muted">
                （本周开放到第 {getScheduleInfo(cfg.activeSubject).currentWeek} 关）
              </span>
            </div>
            <div className="text-xs text-muted">演示用：快进/回退会移动开始日，改变当前周与解锁进度</div>
          </div>
          <ScheduleControls />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/redemptions"
          className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <div className="font-bold text-ink">兑换审批</div>
            <div className="text-xs text-muted">审批员工的积分兑换申请</div>
          </div>
          {pendingRedeems > 0 ? (
            <span className="rounded-full bg-accent-500/15 px-3 py-1 text-sm font-bold text-accent-500">
              {pendingRedeems} 待审
            </span>
          ) : (
            <span className="text-sm text-muted">无待审</span>
          )}
        </Link>
        <Link
          href="/admin/rankings"
          className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <div className="font-bold text-ink">章节排名结算</div>
            <div className="text-xs text-muted">结算每章 top3 奖励</div>
          </div>
          <span className="text-xl">🏆</span>
        </Link>
        <Link
          href="/admin/users"
          className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <div className="font-bold text-ink">员工名单</div>
            <div className="text-xs text-muted">导入员工 / 角色 / 重置密码</div>
          </div>
          <span className="text-xl">👥</span>
        </Link>
        <Link
          href="/admin/content"
          className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <div className="font-bold text-ink">学科与内容</div>
            <div className="text-xs text-muted">切换学科 / 开始日 / 关键词</div>
          </div>
          <span className="text-xl">📚</span>
        </Link>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        （名单管理、学科配置与统计将在后续步骤开放）
      </p>
    </main>
  );
}
