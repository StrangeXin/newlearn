// ===========================================================================
// prisma/seed.ts —— 灌种子数据
//  - AI 学科：5 章 + 100 关键词（来自 prisma/seed-data/ai-keywords.json）
//  - 演示账号：超管 / 管理员 / 若干员工（共享默认密码，首登强制改密）
//  - 激活 AI 学科并设开始日（4 周前的周一，便于演示多章已解锁）
// 可重复执行：先按外键安全顺序清空，再重建。
// ===========================================================================

import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "Aa123456!";

interface SeedKeyword {
  term: string;
  description: string;
  referencePoints: string;
}
interface SeedChapter {
  index: number;
  title: string;
  theme: string;
  keywords: SeedKeyword[];
}

/** 归一章节标题：去掉「第N章」「《》」与「——后缀」，只留简短主标题。 */
function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^第\s*[0-9一二三四五六七八九十]+\s*章\s*/u, "");
  if (t.includes("——")) t = t.split("——")[0];
  t = t.replace(/[《》]/gu, "").trim();
  return t;
}

/** 4 周前的周一 00:00（本地时区）。 */
function mondayWeeksAgo(weeks: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0=周一 .. 6=周日
  d.setDate(d.getDate() - dow - weeks * 7);
  return d;
}

const DEMO_USERS: { name: string; role: "EMPLOYEE" | "ADMIN" | "SUPERADMIN" }[] =
  [
    { name: "超级管理员", role: "SUPERADMIN" },
    { name: "管理员小赵", role: "ADMIN" },
    { name: "张三", role: "EMPLOYEE" },
    { name: "李四", role: "EMPLOYEE" },
    { name: "王五", role: "EMPLOYEE" },
    { name: "赵六", role: "EMPLOYEE" },
    { name: "钱七", role: "EMPLOYEE" },
    { name: "孙八", role: "EMPLOYEE" },
    { name: "周九", role: "EMPLOYEE" },
    { name: "吴十", role: "EMPLOYEE" },
  ];

async function clearAll() {
  // 外键安全顺序：先子后父
  await prisma.pointsLedger.deleteMany();
  await prisma.rankingResult.deleteMany();
  await prisma.followup.deleteMany();
  await prisma.scoring.deleteMany();
  await prisma.keywordProgress.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.activeSubjectConfig.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("⏳ 清空旧数据…");
  await clearAll();

  // ---- 演示账号 ----
  console.log("👤 创建演示账号…");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    await prisma.user.create({
      data: {
        loginName: u.name.trim().toLowerCase(),
        name: u.name,
        passwordHash,
        role: u.role,
        mustChangePassword: true,
        isActivated: false,
      },
    });
  }

  // ---- AI 学科内容 ----
  console.log("📚 导入 AI 学科 100 关键词…");
  const raw = readFileSync(
    join(process.cwd(), "prisma/seed-data/ai-keywords.json"),
    "utf-8",
  );
  const data = JSON.parse(raw) as { chapters: SeedChapter[] };

  const subject = await prisma.subject.create({
    data: {
      title: "人工智能",
      startDate: mondayWeeksAgo(4),
    },
  });

  let total = 0;
  for (const ch of data.chapters.sort((a, b) => a.index - b.index)) {
    const chapter = await prisma.chapter.create({
      data: {
        subjectId: subject.id,
        index: ch.index,
        title: cleanTitle(ch.title),
        theme: ch.theme,
      },
    });
    await prisma.keyword.createMany({
      data: ch.keywords.map((k, i) => ({
        chapterId: chapter.id,
        term: k.term,
        description: k.description,
        referencePoints: k.referencePoints,
        orderIndex: i,
      })),
    });
    total += ch.keywords.length;
  }

  // ---- 激活当前学科 ----
  await prisma.activeSubjectConfig.create({
    data: { singletonId: "GLOBAL", activeSubjectId: subject.id },
  });

  console.log(
    `✅ 完成：${DEMO_USERS.length} 个账号、学科「${subject.title}」共 ${data.chapters.length} 章 / ${total} 关键词，已激活为当前学科。`,
  );
  console.log(`   默认密码：${DEFAULT_PASSWORD}（首登强制改密）`);
}

main()
  .catch((e) => {
    console.error("❌ 种子失败：", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
