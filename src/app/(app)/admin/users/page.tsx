import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin, roleLabel } from "@/lib/auth/user";
import { AddUserForm, ImportUsersForm, UserRowActions } from "./user-forms";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const isSuper = me.role === "SUPERADMIN";

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, phone: true, role: true, isActivated: true },
  });

  const activated = users.filter((u) => u.isActivated).length;
  const pending = users.length - activated;
  const adminCount = users.filter((u) => u.role !== "EMPLOYEE").length;

  return (
    <main className="page py-8">
      <Link href="/admin" className="text-sm text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">员工名单</h1>
          <p className="mt-1 text-sm text-muted">
            预导入名单，员工用「姓名或手机号 + 默认密码 Aa123456!」首次登录并改密即激活。
          </p>
        </div>
        <dl className="flex shrink-0 items-center gap-5 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">在册</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{users.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">已激活</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{activated}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">待登录</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{pending}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">管理员</dt>
            <dd className="text-lg font-bold tabular-nums text-ink">{adminCount}</dd>
          </div>
        </dl>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink">添加单人</h2>
          <p className="mt-0.5 text-xs text-muted">逐个录入，可选填手机号并直接指定为管理员。</p>
          <div className="mt-4">
            <AddUserForm />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold text-ink">批量导入</h2>
          <p className="mt-0.5 text-xs text-muted">粘贴姓名列表；也可用「姓名,手机号」两列导入。</p>
          <div className="mt-4">
            <ImportUsersForm />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">全部成员</h2>
          {pending > 0 && (
            <span className="text-xs text-muted">
              <span className="font-semibold tabular-nums text-ink">{pending}</span> 人尚未首次登录
            </span>
          )}
        </div>
        {users.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <h3 className="text-base font-bold text-ink">名单是空的</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted">
              用上方「批量导入」一次粘进姓名，或「添加单人」逐个录。
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-ink">{u.name}</span>
                  {u.phone && <span className="text-xs tabular-nums text-muted">{u.phone}</span>}
                  {u.role !== "EMPLOYEE" ? (
                    <span className="badge badge-brand">{roleLabel(u.role)}</span>
                  ) : (
                    <span className="badge badge-muted">{roleLabel(u.role)}</span>
                  )}
                  {u.isActivated ? (
                    <span className="badge badge-success">✓ 已激活</span>
                  ) : (
                    <span className="badge badge-muted">待登录</span>
                  )}
                </div>
                <UserRowActions
                  userId={u.id}
                  role={u.role}
                  canManageRole={isSuper && u.id !== me.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
