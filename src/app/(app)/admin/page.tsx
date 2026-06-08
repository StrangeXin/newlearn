import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";
import { getScheduleInfo, isCycleEnded } from "@/lib/schedule";
import { ACTIVE_SUBJECT_WHERE, SUBJECT_ORDER } from "@/lib/subject";
import { ScheduleControls } from "./schedule-controls";

function StatCard({
  label,
  value,
  total,
  hint,
}: {
  label: string;
  value: string | number;
  total?: number;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-ink">{value}</span>
        {total !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-muted">/ {total}</span>
        )}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const NAV_ITEMS = [
  {
    href: "/admin/redemptions",
    title: "兑换审批",
    desc: "审批员工的积分兑换申请",
  },
  {
    href: "/admin/rankings",
    title: "章节排名结算",
    desc: "结算每章前 3 名，各发 +100",
  },
  {
    href: "/admin/users",
    title: "员工名单",
    desc: "导入名单、调角色、重置密码",
  },
  {
    href: "/admin/content",
    title: "学科与内容",
    desc: "上线/下线学科、设开始日、校对关键词",
  },
  {
    href: "/admin/stats",
    title: "数据统计",
    desc: "学习进度、笔记质量、积分财务",
  },
  {
    href: "/admin/learners",
    title: "员工学情",
    desc: "逐人看进度、画像与成长轨迹",
  },
  {
    href: "/admin/ai-logs",
    title: "AI 调用记录",
    desc: "审查每次 AI 打分的上下文与过程",
  },
] as const;

export default async function AdminPage() {
  const admin = await requireAdmin();

  const [employeeCount, adminCount, keywordCount, activatedCount, pendingRedeems, activeSubjects] =
    await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } } }),
      prisma.keyword.count(),
      prisma.user.count({ where: { isActivated: true } }),
      prisma.redemption.count({ where: { status: "PENDING" } }),
      prisma.subject.findMany({
        where: ACTIVE_SUBJECT_WHERE,
        orderBy: SUBJECT_ORDER,
        include: { _count: { select: { chapters: true } } },
      }),
    ]);

  const inactiveCount = employeeCount - activatedCount;
  const subjectsLabel =
    activeSubjects.length === 0
      ? "未开启"
      : activeSubjects.map((s) => s.title).join("、");

  return (
    <main className="page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">管理后台</h1>
          <p className="mt-1.5 text-sm text-muted">
            {admin.name} · 已上线学科
            <span className="ml-1 font-semibold text-brand-700">{subjectsLabel}</span>
          </p>
        </div>
        {pendingRedeems > 0 && (
          <Link
            href="/admin/redemptions"
            className="btn btn-secondary btn-sm"
          >
            <span className="badge badge-brand tabular-nums">{pendingRedeems}</span>
            笔兑换待审批
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="已激活账号"
          value={activatedCount}
          total={employeeCount}
          hint={inactiveCount > 0 ? `${inactiveCount} 人尚未首次登录` : "全员已激活"}
        />
        <StatCard label="员工人数" value={employeeCount} />
        <StatCard label="管理员人数" value={adminCount} />
        <StatCard
          label="关键词库"
          value={keywordCount}
          hint={`${activeSubjects.length} 个学科已上线`}
        />
      </div>

      {activeSubjects.length > 0 ? (
        <div className="mt-5 space-y-3">
          {activeSubjects.map((s) => {
            const { started, currentWeek } = getScheduleInfo(s);
            const totalChapters = s._count.chapters;
            const openChapter = Math.min(currentWeek, totalChapters);
            const ended = isCycleEnded(s, totalChapters);
            return (
              <div
                key={s.id}
                className="card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{s.title}</span>
                    {ended ? (
                      <span className="badge badge-muted">培训周期已结束 · 仅补学</span>
                    ) : started ? (
                      <>
                        <span className="text-sm text-muted">
                          第 <span className="tabular-nums">{currentWeek}</span> 周
                        </span>
                        <span className="badge badge-brand tabular-nums">
                          已解锁第 1 至 {openChapter} 章
                        </span>
                      </>
                    ) : (
                      <span className="badge badge-muted">未设开始日</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {ended
                      ? "全部章节已结算完毕，员工可继续补学（照常拿基础积分，不再参与排名）。需要的话可移动开始日重开周期。"
                      : "自然周（周一到周日）顺序解锁，周日夜结算该周排名。下方按钮移动开始日；回退会重新锁住已解锁的关卡。"}
                  </p>
                </div>
                {started ? (
                  <ScheduleControls subjectId={s.id} />
                ) : (
                  <Link href="/admin/content" className="btn btn-primary btn-sm shrink-0">
                    去设开始日
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="font-bold text-ink">还没开课</div>
            <p className="mt-1.5 text-xs text-muted">
              去「学科与内容」上线学科并设开始日。可同时上线多个学科。
            </p>
          </div>
          <Link href="/admin/content" className="btn btn-primary btn-sm shrink-0">
            去开启学科
          </Link>
        </div>
      )}

      <h2 className="mt-7 text-sm font-semibold text-muted">工作台</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card-link flex items-center justify-between gap-3 p-5"
          >
            <div className="min-w-0">
              <div className="font-semibold text-ink">{item.title}</div>
              <div className="mt-0.5 text-xs text-muted">{item.desc}</div>
            </div>
            {item.href === "/admin/redemptions" ? (
              pendingRedeems > 0 ? (
                <span className="badge badge-brand shrink-0 tabular-nums">{pendingRedeems} 待审</span>
              ) : (
                <span className="badge badge-muted shrink-0">无待审</span>
              )
            ) : (
              <span className="shrink-0 text-muted" aria-hidden>
                →
              </span>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
