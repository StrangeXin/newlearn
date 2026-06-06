"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export interface NavItem {
  href: string;
  label: string;
}

/** 顶栏：桌面端横排导航；窄屏收进汉堡菜单点击展开。
 *  只接收可序列化的安全字段（不把整个 User 传到客户端）。 */
export function AppHeaderBar({
  nav,
  userName,
  roleLabel,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="page flex items-center justify-between gap-3 py-3">
        <Link
          href="/"
          onClick={close}
          className="flex shrink-0 items-center gap-2 font-extrabold text-ink"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">
            智
          </span>
          <span>智学闯关</span>
        </Link>

        {/* 桌面端横排导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 桌面端右侧：身份 + 改密 + 退出 */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <span className="hidden text-sm text-muted lg:inline">{userName}</span>
          <span className="badge badge-brand">{roleLabel}</span>
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

        {/* 窄屏汉堡按钮 */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink transition hover:bg-surface-2 md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* 窄屏展开面板：所有导航 + 身份 + 改密 + 退出 */}
      {open && (
        <div className="border-t border-line bg-surface md:hidden">
          <nav className="page flex flex-col gap-0.5 py-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-3 pt-3">
              <span className="text-sm text-muted">
                {userName} · {roleLabel}
              </span>
              <Link
                href="/change-password"
                onClick={close}
                className="text-sm font-medium text-brand-700 transition hover:text-brand-600"
              >
                改密
              </Link>
            </div>
            <form action={logoutAction} className="px-3 pb-1 pt-2">
              <button type="submit" className="btn btn-secondary btn-sm btn-block">
                退出登录
              </button>
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
