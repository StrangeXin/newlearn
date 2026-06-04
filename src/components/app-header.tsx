import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { roleLabel } from "@/lib/auth/user";
import type { User } from "@/generated/prisma/client";

export function AppHeader({ user }: { user: User }) {
  const isAdmin = user.role !== "EMPLOYEE";
  const home = isAdmin ? "/admin" : "/learn";

  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={home} className="font-extrabold text-brand-700">
          智学闯关
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {!isAdmin && (
            <>
              <Link
                href="/growth"
                className="rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-brand-50 hover:text-brand-700"
              >
                成长
              </Link>
              <Link
                href="/profile"
                className="rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-brand-50 hover:text-brand-700"
              >
                我的
              </Link>
            </>
          )}
          <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
            {roleLabel(user.role)}
          </span>
          <Link
            href="/change-password"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-brand-50 hover:text-brand-700 sm:inline-block"
          >
            修改密码
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-brand-200 px-2.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              退出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
