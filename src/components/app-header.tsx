import { roleLabel } from "@/lib/auth/user";
import type { User } from "@/generated/prisma/client";
import { AppHeaderBar, type NavItem } from "./app-header-bar";

export function AppHeader({ user }: { user: User }) {
  const isAdmin = user.role !== "EMPLOYEE";

  // 管理员既能管也能闯关：顶栏给「管理后台」入口（后台首页汇总名单/内容/排名/审批/统计/AI记录）
  // + 完整的学习侧导航；员工就是学习侧导航。两类菜单结构一致，方便切换。
  const nav: NavItem[] = isAdmin
    ? [
        { href: "/admin", label: "管理后台" },
        { href: "/learn", label: "闯关" },
        { href: "/leaderboard", label: "排行榜" },
        { href: "/redeem", label: "兑换" },
        { href: "/growth", label: "成长" },
        { href: "/profile", label: "我的" },
      ]
    : [
        { href: "/learn", label: "闯关" },
        { href: "/leaderboard", label: "排行榜" },
        { href: "/redeem", label: "兑换" },
        { href: "/growth", label: "成长" },
        { href: "/profile", label: "我的" },
      ];

  return <AppHeaderBar nav={nav} userName={user.name} roleLabel={roleLabel(user.role)} />;
}
