import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { roleLabel } from "@/lib/auth/user";
import type { User } from "@/generated/prisma/client";

export function AppHeader({ user }: { user: User }) {
  const isAdmin = user.role !== "EMPLOYEE";
  const home = isAdmin ? "/admin" : "/learn";

  const nav = isAdmin
    ? [
        { href: "/admin/users", label: "名单", hideOnMobile: true },
        { href: "/admin/content", label: "内容", hideOnMobile: true },
        { href: "/admin/rankings", label: "排名" },
        { href: "/admin/redemptions", label: "兑换审批" },
      ]
    : [
        { href: "/leaderboard", label: "排行榜" },
        { href: "/redeem", label: "兑换" },
        { href: "/growth", label: "成长" },
        { href: "/profile", label: "我的" },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="page flex items-center justify-between gap-3 py-3">
        <Link href={home} className="flex items-center gap-2 font-extrabold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
            智
          </span>
          <span className="hidden sm:inline">智学闯关</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-50 hover:text-brand-700 ${
                "hideOnMobile" in item && item.hideOnMobile ? "hidden sm:inline-block" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted md:inline">{user.name}</span>
          <span className="badge badge-brand">{roleLabel(user.role)}</span>
          <Link
            href="/change-password"
            className="hidden rounded-lg px-2 py-1.5 text-sm text-muted transition hover:bg-brand-50 hover:text-brand-700 lg:inline-block"
          >
            改密
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-secondary btn-sm">
              退出
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
