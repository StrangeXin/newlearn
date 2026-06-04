import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, roleLabel } from "@/lib/auth/user";
import { AddUserForm, ImportUsersForm, UserRowActions } from "./user-forms";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const isSuper = me.role === "SUPERADMIN";

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, role: true, isActivated: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">员工名单</h1>
      <p className="mt-1 text-sm text-muted">
        预导入员工后，员工用「姓名 + 默认密码」首登激活。共 {users.length} 人。
      </p>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white/90 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-ink">添加单人</h2>
          <AddUserForm />
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white/90 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-ink">批量导入</h2>
          <ImportUsersForm />
        </div>
      </section>

      <section className="mt-6">
        <ul className="divide-y divide-brand-100 rounded-2xl border border-brand-100 bg-white/90">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{u.name}</span>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                  {roleLabel(u.role)}
                </span>
                <span className={`text-xs ${u.isActivated ? "text-success-500" : "text-muted"}`}>
                  {u.isActivated ? "已激活" : "未激活"}
                </span>
              </div>
              <UserRowActions
                userId={u.id}
                role={u.role}
                canManageRole={isSuper && u.id !== me.id}
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
