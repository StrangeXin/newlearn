// ===========================================================================
// prisma/seed.ts —— 灌种子数据
//  - AI 学科：5 章 + 100 关键词（来自 prisma/seed-data/ai-keywords.json）
//  - 演示账号：超管 / 管理员 / 若干员工（共享默认密码，首登强制改密）
//  - 激活 AI 学科并设开始日（4 周前的周一，便于演示多章已解锁）
// 可重复执行：先按外键安全顺序清空，再重建。
// ===========================================================================

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import { MockScoringService } from "../src/lib/scoring/mock";
import { computeMemoryDiff } from "../src/lib/memory-diff";
import type { LearnerMemoryTags, LearnerProfile } from "../src/lib/scoring/types";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

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

/** 读取某学科目录下所有 chapter-*.json，按 index 升序组装。 */
function loadChapters(subjectDir: string): { chapters: SeedChapter[] } {
  const dir = join(process.cwd(), "prisma/seed-data", subjectDir);
  const chapters = readdirSync(dir)
    .filter((f) => /^chapter-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as SeedChapter)
    .sort((a, b) => a.index - b.index);
  return { chapters };
}

// ---- 模拟学习：用 Mock 评分器真实跑若干关键词，产出画像与成长轨迹快照 ----
const scorer = new MockScoringService();
const EMPTY: LearnerMemoryTags = { strengths: [], weaknesses: [], interests: [], blindSpots: [] };

function splitRefs(s: string | null): string[] {
  return s ? s.split(/[;；]/).map((x) => x.trim()).filter(Boolean) : [];
}
/** 按「质量等级 level(0~1)」确定性地造一份笔记：用真实简介+考核要点，覆盖度随 level 增长。 */
function buildNote(term: string, description: string | null, refs: string[], level: number): string {
  const covered = refs.slice(0, Math.max(1, Math.ceil(refs.length * level)));
  const desc = (description ?? "").trim();
  const head = desc ? `${term}，${desc}` : `${term} 是这一章里我重点啃的一个概念。`;
  const points = covered
    .map((r) => `关于${r}，我查资料后用自己的话理了一遍，能结合一个具体例子说清楚，而不是死记。`)
    .join("");
  return `${head}\n我重点弄清了：${points}`;
}

/** 用关键词真实简介 + 考核要点拼一份像样的同伴笔记（排名/同伴可见性演示，非占位模板）。
 *  按岗位确定性地选不同口吻，让不同同事的笔记看着各有风格、而非一个模板。 */
function buildSeedNote(
  term: string,
  description: string | null,
  refs: string[],
  position: string,
): string {
  let v = 0;
  for (const c of position) v = (v + c.charCodeAt(0)) % 3;
  const desc = (description ?? "").trim();
  const lead = [
    desc ? `${term}，${desc}` : `${term} 是这一章我花时间最多的一个概念。`,
    desc ? `先记一句话：${term}，${desc}` : `${term} 我反复看了好几遍才算理顺。`,
    desc ? `${term}。${desc}` : `${term} 乍看简单，真要讲清楚并不容易。`,
  ][v];
  const mid = refs.length
    ? `我重点弄清了这几块：${refs.join("；")}。每一块都对着资料用自己的话讲了一遍，确认没有想当然。`
    : `我把它的来龙去脉、适用边界和一个典型例子都梳理了一遍。`;
  const tail = [
    `结合我做${position}的工作，${term} 的思路能用在实际场景里做判断和取舍，而不是停在背定义。`,
    `从${position}的角度看，${term} 最有用的是把它的底层逻辑迁移到我手头的问题上。`,
    `我是做${position}的，${term} 对我的价值在于给了一个想清楚边界与取舍的框架。`,
  ][v];
  return `${lead}\n${mid}\n${tail}`;
}
function buildAnswer(level: number): string {
  return "我的回答结合了原理与具体例子来展开说明。".repeat(Math.max(1, Math.round(level * 6)));
}

async function simulateLearning(
  subjectId: string,
  loginName: string,
  profile: LearnerProfile,
  levels: number[],
): Promise<void> {
  const u = await prisma.user.findUnique({ where: { loginName: loginName.toLowerCase() } });
  if (!u) return;
  await prisma.employeeProfile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, ...profile },
    update: profile,
  });

  const ch1 = await prisma.chapter.findFirst({ where: { subjectId, index: 1 } });
  if (!ch1) return;
  const kws = await prisma.keyword.findMany({
    where: { chapterId: ch1.id },
    orderBy: { orderIndex: "asc" },
    take: levels.length,
  });

  let tags: LearnerMemoryTags = EMPTY;
  let portrait = "";
  let seq = 0;
  for (let i = 0; i < kws.length; i += 1) {
    const kw = kws[i];
    const level = levels[i];
    const scKw = {
      term: kw.term,
      description: kw.description ?? undefined,
      referencePoints: splitRefs(kw.referencePoints),
    };
    const note = buildNote(kw.term, kw.description, scKw.referencePoints, level);
    const { followups } = await scorer.submitNote({ note, keyword: scKw, learner: { profile } });
    const answers = followups.map(() => buildAnswer(level));
    const fin = await scorer.finalize({ note, keyword: scKw, followups, answers, learner: { profile } });
    const prevTags = tags;
    const prevPortrait = portrait;
    const upd = await scorer.updateMemory({
      keyword: scKw,
      note,
      followups,
      answers,
      finalScore: fin.finalScore,
      learner: { profile, memory: { tags, portrait } },
    });
    seq += 1;
    const diff = computeMemoryDiff(prevTags, upd.tags, prevPortrait, upd.portrait);
    tags = upd.tags;
    portrait = upd.portrait;
    await prisma.employeeMemory.upsert({
      where: { userId: u.id },
      create: { userId: u.id, tags: json(tags), portrait, updateCount: seq },
      update: { tags: json(tags), portrait, updateCount: seq },
    });
    await prisma.employeeMemorySnapshot.create({
      data: {
        userId: u.id,
        keywordId: kw.id,
        keywordTerm: kw.term,
        finalScore: fin.finalScore,
        tags: json(tags),
        portrait,
        diff: json(diff),
        seq,
      },
    });

    // 真实进度与积分：达标记进度并发 1 基础分
    const passed = fin.finalScore >= 60;
    const prog = await prisma.keywordProgress.create({
      data: {
        userId: u.id,
        keywordId: kw.id,
        chapterId: ch1.id,
        subjectId,
        bestFinalScore: fin.finalScore,
        isCompleted: passed,
        completedAt: passed ? new Date() : null,
      },
    });
    if (passed) {
      await prisma.pointsLedger.create({
        data: {
          userId: u.id,
          subjectId,
          type: "BASE",
          amount: 1,
          keywordProgressId: prog.id,
          memo: `完成「${kw.term}」`,
        },
      });
    }
  }
  const passedCount = await prisma.keywordProgress.count({
    where: { userId: u.id, isCompleted: true },
  });
  console.log(
    `   🧬 模拟「${loginName}」完成 ${kws.length} 词（通过 ${passedCount}），画像更新 ${seq} 次`,
  );
}

/** 直接给某员工补「完成某章全部关键词」的进度+基础分（用于排名演示），均分=avg，本周内完成。 */
async function seedChapterCompletion(
  subjectId: string,
  startDate: Date,
  loginName: string,
  profile: LearnerProfile,
  chapterIndex: number,
  avg: number,
): Promise<void> {
  const u = await prisma.user.findUnique({ where: { loginName: loginName.toLowerCase() } });
  if (!u) return;
  await prisma.employeeProfile.upsert({
    where: { userId: u.id },
    create: { userId: u.id, ...profile },
    update: profile,
  });
  const ch = await prisma.chapter.findFirst({
    where: { subjectId, index: chapterIndex },
    include: { keywords: true },
  });
  if (!ch) return;
  const completedAt = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 第1周内
  for (const kw of ch.keywords) {
    const sub = await prisma.submission.create({
      data: {
        userId: u.id,
        keywordId: kw.id,
        noteText: buildSeedNote(kw.term, kw.description, splitRefs(kw.referencePoints), profile.position),
        status: "COMPLETED",
        finalScore: avg,
        isPassed: true,
      },
    });
    const prog = await prisma.keywordProgress.create({
      data: {
        userId: u.id,
        keywordId: kw.id,
        chapterId: ch.id,
        subjectId,
        bestFinalScore: avg,
        bestSubmissionId: sub.id,
        isCompleted: true,
        completedAt,
      },
    });
    await prisma.pointsLedger.create({
      data: { userId: u.id, subjectId, type: "BASE", amount: 1, keywordProgressId: prog.id },
    });
  }
  console.log(`   🏁 「${loginName}」完成第${chapterIndex}章全部（均分 ${avg}）`);
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
  await prisma.employeeMemorySnapshot.deleteMany();
  await prisma.employeeMemory.deleteMany();
  await prisma.employeeProfile.deleteMany();
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
  // 每章一个独立 JSON（prisma/seed-data/ai/chapter-N.json），避免单文件过大；
  // 目录扫描 + 按 index 排序，未来加学科只需新建对应目录。
  console.log("📚 导入 AI 学科 100 关键词…");
  const data = loadChapters("ai");

  const subject = await prisma.subject.create({
    data: {
      title: "人工智能",
      // 2 周前开课 → 当前第 3 周：第 1–3 关开放、4–5 关锁定（便于演示周解锁）
      startDate: mondayWeeksAgo(2),
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

  // ---- 模拟一名员工的学习轨迹（让成长轨迹页开箱即看；其余员工保留空白以演示 onboarding）----
  console.log("🧬 模拟员工学习轨迹…");
  await simulateLearning(
    subject.id,
    "李四",
    {
      position: "数据分析师",
      department: "数据部",
      level: "P5 / 3 年",
      background: "统计学专业，熟悉 Python 与 SQL",
      aiFamiliarity: "了解（知道一些概念）",
      applicationAreas: "用户行为分析、自动化报表、异常检测",
    },
    [0.3, 0.55, 0.85, 0.65, 0.95, 1.0],
  );

  // 排名演示：4 名员工完成第 1 章全部（不同均分，含并列 75 演示「并列均给」）
  const startDate = subject.startDate!;
  await seedChapterCompletion(subject.id, startDate, "赵六", { position: "算法工程师", department: "AI实验室", level: "P7/8年", background: "机器学习博士", aiFamiliarity: "精通（能落地应用）", applicationAreas: "模型研发、效果优化" }, 1, 88);
  await seedChapterCompletion(subject.id, startDate, "钱七", { position: "前端工程师", department: "产品研发", level: "P6/5年", background: "计算机科学", aiFamiliarity: "熟练（用过一些工具）", applicationAreas: "AI 辅助编码、组件生成" }, 1, 82);
  await seedChapterCompletion(subject.id, startDate, "孙八", { position: "测试工程师", department: "质量部", level: "P5/4年", background: "软件工程", aiFamiliarity: "了解（知道一些概念）", applicationAreas: "用例生成、缺陷分析" }, 1, 75);
  await seedChapterCompletion(subject.id, startDate, "周九", { position: "运维工程师", department: "基础设施", level: "P6/6年", background: "网络与系统", aiFamiliarity: "了解（知道一些概念）", applicationAreas: "日志分析、告警归因" }, 1, 75);

  // 给李四种一个待审兑换，演示审批流
  const liSi = await prisma.user.findUnique({ where: { loginName: "李四" } });
  if (liSi) {
    await prisma.redemption.create({
      data: {
        userId: liSi.id,
        subjectId: subject.id,
        item: "技术书籍《深度学习》",
        amount: 3,
        status: "PENDING",
      },
    });
  }

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
