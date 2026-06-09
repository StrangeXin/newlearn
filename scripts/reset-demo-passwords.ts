// ===========================================================================
// 把演示账号的密码重置回默认值，并关闭强制改密。
// 用途：公开 demo 站点上有人改了演示账号密码后，一键恢复成可重复登录的状态。
// 幂等、不动其它数据。用 tsx 跑，连接串由 DATABASE_URL 提供。
//   DATABASE_URL=... tsx scripts/reset-demo-passwords.ts
// ===========================================================================

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// 与 prisma/seed.ts 的 DEMO_USERS 一致；loginName = 姓名 trim + 小写
const DEMO_NAMES = [
  "超级管理员",
  "管理员小赵",
  "张三",
  "李四",
  "王五",
  "赵六",
  "钱七",
  "孙八",
  "周九",
  "吴十",
];

async function main() {
  const password = process.env.DEFAULT_PASSWORD ?? "Aa123456!";
  const passwordHash = await bcrypt.hash(password, 10);
  const loginNames = DEMO_NAMES.map((n) => n.trim().toLowerCase());
  const result = await prisma.user.updateMany({
    where: { loginName: { in: loginNames } },
    data: { passwordHash, mustChangePassword: false },
  });
  console.log(`✅ 已把 ${result.count} 个演示账号密码重置为默认值，并关闭强制改密。`);
}

main()
  .catch((e) => {
    console.error("重置失败：", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
