import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/user";

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

  const [employeeCount, adminCount, keywordCount, activatedCount, cfg] =
    await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE" } }),
      prisma.user.count({ where: { role: { in: ["ADMIN", "SUPERADMIN"] } } }),
      prisma.keyword.count(),
      prisma.user.count({ where: { isActivated: true } }),
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

      <p className="mt-8 text-center text-xs text-muted">
        （名单管理、学科配置、审批与统计将在后续步骤开放）
      </p>
    </main>
  );
}
