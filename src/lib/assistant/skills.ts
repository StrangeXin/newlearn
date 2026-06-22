import { prisma } from "@/lib/db";
import { getScheduleInfo } from "@/lib/schedule";
import { getActiveSubjects } from "@/lib/subject";
import {
  getAccountBalance,
  getAvailableBalance,
  getPendingRedeemTotal,
} from "@/lib/redemption";
import { getPeerNotes } from "@/lib/social";
import { getFinanceStats, getLearnerDetail } from "@/lib/stats";
import type {
  AssistantConfirmation,
  AssistantEntityRef,
  AssistantHistoryMessage,
  AssistantPageContext,
  AssistantSkill,
  AssistantToolContext,
  AssistantToolResult,
  ReminderDraft,
  RedemptionDraft,
} from "./types";

function hasAny(message: string, words: string[]) {
  return words.some((word) => message.includes(word.toLowerCase()));
}

function normalize(message: string) {
  return message.trim().toLowerCase();
}

function inputText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of ["text", "message", "name", "loginName", "identifier"]) {
      if (typeof record[key] === "string") return record[key].trim();
    }
  }
  return "";
}

function inputBool(input: unknown, key: string): boolean | undefined {
  return input && typeof input === "object" && typeof (input as Record<string, unknown>)[key] === "boolean"
    ? Boolean((input as Record<string, unknown>)[key])
    : undefined;
}

function inputString(input: unknown, keys: string[]): string {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
  }
  return "";
}

function normalizeTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, "");
}

function refersToPreviousPeople(message: string, history: AssistantHistoryMessage[]) {
  if (!hasAny(message, ["分别", "哪些人", "名单", "是谁", "哪几个", "都有谁"])) return false;
  const lastAssistant = [...history].reverse().find((m) => m.role === "ASSISTANT")?.content ?? "";
  return lastAssistant.includes("员工") || lastAssistant.includes("管理员");
}

function parseRedemptionDraft(message: string): RedemptionDraft | null {
  const text = message.trim();
  const amountMatch = text.match(/(\d{1,6})\s*(?:元|积分|分)?/);
  const amount = amountMatch ? Number(amountMatch[1]) : 0;
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;

  const category = text.includes("书")
    ? "BOOK"
    : text.includes("课") || text.includes("会员")
      ? "COURSE"
      : text.includes("工具") || text.includes("软件")
        ? "TOOL"
        : "OTHER";

  const cleaned = text
    .replace(/帮我|我要|想要|申请|兑换|报销|买|一本|一个|一份|元|积分|分/g, " ")
    .replace(/\d{1,6}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const item = cleaned || (category === "BOOK" ? "学习书籍" : "学习工具");
  return { kind: "requestRedemption", item: item.slice(0, 60), category, amount };
}

function buildReminderDraft(message: string): ReminderDraft {
  const cadence = message.includes("每周")
    ? "每周"
    : message.includes("每天") || message.includes("每日")
      ? "每天"
      : "一次性";
  const target = message.includes("管理员") || message.includes("审批") ? "管理员" : "本人";
  return {
    kind: "createReminderDraft",
    title: message.includes("反思") ? "完成章节反思提醒" : "学习进度提醒",
    cadence,
    target,
  };
}

async function getLearningProgress(userId: string): Promise<AssistantToolResult> {
  const subjects = await getActiveSubjects();
  if (subjects.length === 0) {
    return {
      summary: "当前没有已上线的学习主题。",
      data: { subjects: [] },
      navigation: [{ label: "查看闯关地图", href: "/learn" }],
    };
  }

  const rows = await Promise.all(
    subjects.map(async (subject) => {
      const [total, completed, chapters, reflections, todayCompleted] = await Promise.all([
        prisma.keyword.count({ where: { chapter: { subjectId: subject.id } } }),
        prisma.keywordProgress.count({ where: { userId, subjectId: subject.id, isCompleted: true } }),
        prisma.chapter.findMany({
          where: { subjectId: subject.id },
          orderBy: { index: "asc" },
          select: { id: true, index: true, title: true },
        }),
        prisma.chapterReflection.count({
          where: { userId, chapter: { subjectId: subject.id }, summary: { not: "" } },
        }),
        prisma.keywordProgress.count({
          where: {
            userId,
            subjectId: subject.id,
            isCompleted: true,
            completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);
      const schedule = getScheduleInfo(subject);
      const unlocked = chapters.filter((chapter) => chapter.index <= schedule.currentWeek);
      return {
        subjectId: subject.id,
        title: subject.title,
        completed,
        total,
        currentWeek: schedule.currentWeek,
        unlockedChapters: unlocked.map((chapter) => chapter.index),
        reflectionDone: reflections,
        todayCompleted,
      };
    }),
  );

  const first = rows[0];
  const summary = first
    ? `你当前在「${first.title}」已完成 ${first.completed}/${first.total} 个关键词；本周解锁到第 ${first.currentWeek} 章，今天已新完成 ${first.todayCompleted} 个。`
    : "还没有可学习主题。";

  return {
    summary,
    data: { subjects: rows },
    navigation: [{ label: "去闯关地图", href: "/learn" }],
  };
}

async function getPersonalAccount(userId: string): Promise<AssistantToolResult> {
  const [balance, pending, available, recent] = await Promise.all([
    getAccountBalance(userId),
    getPendingRedeemTotal(userId),
    getAvailableBalance(userId),
    prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { type: true, amount: true, memo: true, createdAt: true },
    }),
  ]);
  return {
    summary: `你的积分余额 ${balance}，待审批占用 ${pending}，当前可用 ${available}。`,
    data: { balance, pending, available, recent },
    navigation: [{ label: "查看积分兑换", href: "/redeem" }],
  };
}

async function draftRedemption(
  userId: string,
  draft: RedemptionDraft,
): Promise<AssistantToolResult<{ available: number; draft: RedemptionDraft }>> {
  const available = await getAvailableBalance(userId);
  const ok = draft.amount <= available;
  return {
    summary: ok
      ? `我已整理好兑换申请草案：${draft.item}，${draft.amount} 积分。请确认后提交。`
      : `你的可用积分为 ${available}，不足以申请 ${draft.amount} 积分的兑换。`,
    data: { available, draft },
    confirmation: ok ? draft : undefined,
    navigation: [{ label: "查看兑换页", href: "/redeem" }],
  };
}

function wantsPeopleList(message: string, history: AssistantHistoryMessage[]) {
  return hasAny(message, ["分别", "哪些人", "名单", "是谁", "哪几个", "都有谁"]) ||
    refersToPreviousPeople(message, history);
}

function extractLearnerIdentifier(input: unknown): string {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of ["name", "loginName", "phone", "identifier"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
  }
  const text = inputText(input);
  const patterns = [
    /(?:查|看|看看|给我看下|给我看一下)?\s*([\u4e00-\u9fa5A-Za-z0-9_\-]{2,30})\s*的(?:数据|学情|画像|进度|记录|详情)/,
    /(?:员工|学员|用户)\s*([\u4e00-\u9fa5A-Za-z0-9_\-]{2,30})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return text.replace(/的数据|的学情|的画像|的进度|给我看下|给我看一下|帮我|查一下|看看|查询|查看/g, "").trim();
}

function extractKeywordIdentifier(input: unknown): string {
  const fromArgs = inputString(input, ["keyword", "keywordTerm", "term", "name"]);
  if (fromArgs) return fromArgs;
  const text = inputText(input);
  const quoted = text.match(/[「“"]([^」”"]{2,80})[」”"]/);
  if (quoted?.[1]) return quoted[1].trim();
  const beforeKeyword = text.match(/([\u4e00-\u9fa5A-Za-z0-9 ()（）/_-]{2,80})(?:这个|该)?关键词/);
  if (beforeKeyword?.[1]) {
    return beforeKeyword[1]
      .replace(/张三|李四|王五|赵六|的|平均分|多少|是|查|看/g, "")
      .trim();
  }
  return text.replace(/关键词|平均分|多少|张三|李四|王五|赵六|这个|该|的|查|看/g, "").trim();
}

function extractKeywordIdentifiers(input: unknown): string[] {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record.keywords)) {
      return record.keywords
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim());
    }
  }
  const text = inputText(input);
  const cleaned = text
    .replace(/分别有哪些人完成了|有哪些人完成了|哪些人完成了|谁完成了|完成名单|完成人|关键词|查询|查看/g, " ")
    .replace(/[?？]/g, " ");
  return cleaned
    .split(/[、,，和与及\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !["张三", "李四", "王五", "赵六", "分别", "哪些人", "完成了"].includes(item));
}

function hasExplicitKeywordInput(input: unknown): boolean {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (["keyword", "keywordTerm", "term"].some((key) => typeof record[key] === "string" && Boolean(record[key].trim()))) {
      return true;
    }
  }
  const text = inputText(input);
  return hasAny(text, ["关键词", "图灵机", "图灵测试", "人工智能", "达特茅斯", "符号主义", "连接主义", "高频qrs", "高频QRS"]);
}

async function resolveLearner(input: unknown): Promise<AssistantToolResult<{ found: boolean; learner?: AssistantEntityRef; candidates?: AssistantEntityRef[] }>> {
  const identifier = extractLearnerIdentifier(input);
  if (!identifier) {
    return {
      summary: "需要先明确员工姓名、登录名或手机号。",
      data: { found: false },
      navigation: [{ label: "员工学情", href: "/admin/learners" }],
    };
  }

  const users = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      OR: [
        { name: { equals: identifier } },
        { loginName: { equals: identifier.toLowerCase() } },
        { phone: { equals: identifier.replace(/[\s-]/g, "") } },
        { name: { contains: identifier } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, name: true, loginName: true, phone: true, isActivated: true },
  });
  const user = users[0];

  if (!user) {
    return {
      summary: `没有找到「${identifier}」这名员工。你可以换姓名、登录名或手机号再试。`,
      data: { found: false },
      navigation: [{ label: "员工学情", href: "/admin/learners" }],
    };
  }
  const learner = { id: user.id, name: user.name };
  return {
    summary: `已定位员工「${user.name}」。`,
    data: { found: true, learner, candidates: users.map((u) => ({ id: u.id, name: u.name })) },
    contextWrites: { learner },
    navigation: [{ label: `查看${user.name}详情`, href: `/admin/learners/${user.id}` }],
  };
}

async function resolveKeyword(
  input: unknown,
  ctx?: AssistantToolContext,
): Promise<AssistantToolResult<{ found: boolean; ambiguous?: boolean; keyword?: AssistantEntityRef; subject?: AssistantEntityRef; candidates?: { id: string; name: string; subject: AssistantEntityRef }[] }>> {
  const identifier = extractKeywordIdentifier(input);
  if (!identifier) {
    return {
      summary: "需要先明确关键词名称。",
      data: { found: false },
    };
  }
  const normalized = normalizeTerm(identifier);
  const keywords = await prisma.keyword.findMany({
    where: {
      OR: [
        { term: { equals: identifier } },
        { term: { contains: identifier } },
      ],
    },
    orderBy: { orderIndex: "asc" },
    take: 10,
    select: {
      id: true,
      term: true,
      chapter: { select: { subject: { select: { id: true, title: true } } } },
    },
  });
  const exactMatches = keywords.filter((k) => normalizeTerm(k.term) === normalized);
  const looseMatches = keywords.filter((k) => normalizeTerm(k.term).includes(normalized));
  const candidates = (exactMatches.length > 0 ? exactMatches : looseMatches).map((k) => ({
    id: k.id,
    name: k.term,
    subject: { id: k.chapter.subject.id, name: k.chapter.subject.title },
  }));

  const subjectScoped = ctx?.learningContext.subject
    ? candidates.filter((candidate) => candidate.subject.id === ctx.learningContext.subject?.id)
    : [];
  const completedByLearner =
    candidates.length > 1 && ctx?.learningContext.learner
      ? await prisma.keywordProgress.findMany({
          where: {
            userId: ctx.learningContext.learner.id,
            keywordId: { in: candidates.map((candidate) => candidate.id) },
            isCompleted: true,
          },
          select: { keywordId: true },
        })
      : [];
  const completedCandidateIds = new Set(completedByLearner.map((row) => row.keywordId));
  const learnerScoped = candidates.filter((candidate) => completedCandidateIds.has(candidate.id));
  const chosen =
    candidates.length === 1
      ? candidates[0]
      : subjectScoped.length === 1
        ? subjectScoped[0]
        : learnerScoped.length === 1
          ? learnerScoped[0]
          : null;

  const keyword = chosen
    ? keywords.find((k) => k.id === chosen.id) ?? null
    : null;
  if (!keyword) {
    if (candidates.length > 1) {
      return {
        summary: `「${identifier}」匹配到多个关键词，需要用户确认具体指哪一个。`,
        data: { found: false, ambiguous: true, candidates },
      };
    }
    return {
      summary: `没有找到「${identifier}」这个关键词。`,
      data: {
        found: false,
        candidates: keywords.map((k) => ({
          id: k.id,
          name: k.term,
          subject: { id: k.chapter.subject.id, name: k.chapter.subject.title },
        })),
      },
    };
  }
  const keywordRef = { id: keyword.id, name: keyword.term };
  const subjectRef = { id: keyword.chapter.subject.id, name: keyword.chapter.subject.title };
  return {
    summary: `已定位关键词「${keyword.term}」（${keyword.chapter.subject.title}）。`,
    data: {
      found: true,
      keyword: keywordRef,
      subject: subjectRef,
      candidates: keywords.map((k) => ({
        id: k.id,
        name: k.term,
        subject: { id: k.chapter.subject.id, name: k.chapter.subject.title },
      })),
    },
    contextWrites: { keyword: keywordRef, subject: subjectRef },
  };
}

async function getAdminLearnerOverview(
  input: unknown,
  ctx?: AssistantToolContext,
): Promise<AssistantToolResult> {
  const learner = inputString(input, ["learnerId", "userId"])
    ? { id: inputString(input, ["learnerId", "userId"]), name: inputString(input, ["name"]) }
    : ctx?.learningContext.learner;
  const userId = learner?.id;
  if (!userId) {
    return {
      summary: "需要先定位员工，才能查询员工概览。",
      data: { found: false, reason: "missing_learner" },
      navigation: [{ label: "员工学情", href: "/admin/learners" }],
    };
  }

  const detail = await getLearnerDetail(userId);
  if (!detail) {
    return {
      summary: `没有读到该员工的学情明细。`,
      data: { found: false },
      navigation: [{ label: "员工学情", href: "/admin/learners" }],
    };
  }

  const totalCompleted = detail.subjects.reduce((sum, subject) => sum + subject.completed, 0);
  const totalKeywords = detail.subjects.reduce((sum, subject) => sum + subject.total, 0);
  const scoredSubjects = detail.subjects.filter((subject) => subject.completed > 0);
  const avgScore =
    scoredSubjects.length === 0
      ? 0
      : Math.round(
          (scoredSubjects.reduce((sum, subject) => sum + subject.avgScore, 0) / scoredSubjects.length) * 10,
        ) / 10;
  const latestRecords = detail.records.slice(0, 5).map((record) => ({
    term: record.term,
    subjectTitle: record.subjectTitle,
    chapterIndex: record.chapterIndex,
    score: record.score,
  }));
  const profileText = detail.profile
    ? `${detail.profile.department || "未填部门"} / ${detail.profile.position || "未填岗位"} / ${detail.profile.level || "未填层级"}`
    : "未填写 onboarding 资料";
  const memoryText = detail.memory
    ? `画像已更新 ${detail.memory.updateCount} 次，摘要：${detail.memory.portrait.slice(0, 120) || "暂无画像摘要"}`
    : "还没有形成学习画像";
  const subjectLines = detail.subjects
    .map((subject) => `${subject.title} ${subject.completed}/${subject.total}，均分 ${subject.avgScore || 0}，学科积分 ${subject.points}`)
    .join("；");

  return {
    summary: `「${detail.name}」${detail.isActivated ? "已激活" : "未激活"}。资料：${profileText}。总体完成 ${totalCompleted}/${totalKeywords} 个关键词，均分 ${avgScore}。钱包：累计 ${detail.wallet.earned}，已兑换 ${detail.wallet.redeemed}，余额 ${detail.wallet.balance}。${memoryText}。学科进度：${subjectLines || "暂无学科进度"}。`,
    data: {
      found: true,
      user: { id: detail.userId, name: detail.name, isActivated: detail.isActivated },
      wallet: detail.wallet,
      profile: detail.profile,
      memory: detail.memory,
      subjects: detail.subjects,
      totalCompleted,
      totalKeywords,
      avgScore,
      latestRecords,
    },
    contextWrites: { learner: { id: detail.userId, name: detail.name } },
    navigation: [{ label: `查看${detail.name}详情`, href: `/admin/learners/${detail.userId}` }],
  };
}

async function getAdminLearnerDetail(input: unknown, ctx?: AssistantToolContext): Promise<AssistantToolResult> {
  const resolved = await resolveLearner(input);
  if (!resolved.contextWrites?.learner) return resolved;
  return getAdminLearnerOverview(
    { learnerId: resolved.contextWrites.learner.id, name: resolved.contextWrites.learner.name },
    { ...ctx, learningContext: { ...(ctx?.learningContext ?? {}), learner: resolved.contextWrites.learner } } as AssistantToolContext,
  );
}

async function listLearnerKeywordRecords(
  input: unknown,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const learnerId = inputString(input, ["learnerId", "userId"]) || ctx.learningContext.learner?.id;
  if (!learnerId) {
    return {
      summary: "需要先定位员工，才能查询他完成过哪些关键词。",
      data: { found: false, reason: "missing_learner" },
      navigation: [{ label: "员工学情", href: "/admin/learners" }],
    };
  }
  const [user, progresses] = await Promise.all([
    prisma.user.findUnique({ where: { id: learnerId }, select: { id: true, name: true } }),
    prisma.keywordProgress.findMany({
      where: { userId: learnerId, isCompleted: true },
      orderBy: [{ subjectId: "asc" }, { completedAt: "asc" }],
      include: {
        keyword: {
          include: {
            chapter: { select: { index: true, subject: { select: { id: true, title: true } } } },
          },
        },
      },
    }),
  ]);
  if (!user) {
    return { summary: "没有读到该员工的关键词记录。", data: { found: false } };
  }
  const records = progresses.map((progress) => ({
    keywordId: progress.keywordId,
    term: progress.keyword.term,
    subjectId: progress.subjectId,
    subjectTitle: progress.keyword.chapter.subject.title,
    chapterIndex: progress.keyword.chapter.index,
    score: progress.bestFinalScore,
    completedAt: progress.completedAt,
  }));
  const avgScore =
    records.length === 0
      ? 0
      : Math.round((records.reduce((sum, record) => sum + record.score, 0) / records.length) * 10) / 10;
  return {
    summary: `「${user.name}」已完成 ${records.length} 个关键词，个人完成记录均分 ${avgScore}。`,
    data: { found: true, learner: { id: user.id, name: user.name }, count: records.length, avgScore, records },
    contextWrites: { learner: { id: user.id, name: user.name } },
    navigation: [{ label: `查看${user.name}详情`, href: `/admin/learners/${user.id}` }],
  };
}

async function getLearnerKeywordRecord(
  input: unknown,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const learnerId = inputString(input, ["learnerId", "userId"]) || ctx.learningContext.learner?.id;
  const explicitKeyword = hasExplicitKeywordInput(input);
  let keywordId = explicitKeyword ? "" : inputString(input, ["keywordId"]) || ctx.learningContext.keyword?.id;
  let keywordRef = ctx.learningContext.keyword;
  if (!keywordId) {
    const resolved = await resolveKeyword(input, ctx);
    keywordId = resolved.contextWrites?.keyword?.id ?? "";
    keywordRef = resolved.contextWrites?.keyword;
    if (!keywordId && (resolved.data as { ambiguous?: boolean }).ambiguous) return resolved;
  }
  if (!learnerId || !keywordId) {
    return {
      summary: "需要同时明确员工和关键词，才能查询个人关键词得分。",
      data: { found: false, missing: { learner: !learnerId, keyword: !keywordId } },
    };
  }
  const [user, progress] = await Promise.all([
    prisma.user.findUnique({ where: { id: learnerId }, select: { id: true, name: true } }),
    prisma.keywordProgress.findUnique({
      where: { userId_keywordId: { userId: learnerId, keywordId } },
      include: {
        keyword: {
          include: { chapter: { select: { index: true, subject: { select: { id: true, title: true } } } } },
        },
        bestSubmission: {
          select: {
            noteText: true,
            scoring: {
              select: {
                feedback: true,
                followups: {
                  orderBy: { order: "asc" },
                  select: { question: true, answer: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);
  if (!user || !progress?.isCompleted) {
    return {
      summary: `${user?.name ?? "该员工"}还没有完成「${keywordRef?.name ?? "该关键词"}」。`,
      data: { found: false, completed: false },
      contextWrites: {
        learner: user ? { id: user.id, name: user.name } : ctx.learningContext.learner,
        keyword: keywordRef,
      },
    };
  }
  const keyword = { id: progress.keywordId, name: progress.keyword.term };
  const subject = { id: progress.subjectId, name: progress.keyword.chapter.subject.title };
  return {
    summary: `「${user.name}」在「${progress.keyword.term}」的最终分是 ${progress.bestFinalScore}。`,
    data: {
      found: true,
      learner: { id: user.id, name: user.name },
      keyword,
      subject,
      chapterIndex: progress.keyword.chapter.index,
      score: progress.bestFinalScore,
      completedAt: progress.completedAt,
      note: progress.bestSubmission?.noteText ?? "",
      feedback: progress.bestSubmission?.scoring?.feedback ?? "",
      followups: progress.bestSubmission?.scoring?.followups ?? [],
    },
    contextWrites: { learner: { id: user.id, name: user.name }, keyword, subject },
    navigation: [{ label: `查看${user.name}详情`, href: `/admin/learners/${user.id}` }],
  };
}

async function getKeywordAnalytics(
  input: unknown,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const explicitKeyword = hasExplicitKeywordInput(input);
  let keywordId = explicitKeyword ? "" : inputString(input, ["keywordId"]) || ctx.learningContext.keyword?.id;
  if (!keywordId) {
    const resolved = await resolveKeyword(input, ctx);
    keywordId = resolved.contextWrites?.keyword?.id ?? "";
    if (!keywordId && (resolved.data as { ambiguous?: boolean }).ambiguous) return resolved;
  }
  if (!keywordId) {
    return { summary: "需要先明确关键词，才能查询关键词统计。", data: { found: false } };
  }
  const [keyword, agg, rows] = await Promise.all([
    prisma.keyword.findUnique({
      where: { id: keywordId },
      include: { chapter: { select: { index: true, subject: { select: { id: true, title: true } } } } },
    }),
    prisma.keywordProgress.aggregate({
      where: { keywordId, isCompleted: true },
      _avg: { bestFinalScore: true },
      _count: { _all: true },
      _min: { bestFinalScore: true },
      _max: { bestFinalScore: true },
    }),
    prisma.keywordProgress.findMany({
      where: { keywordId, isCompleted: true },
      orderBy: { bestFinalScore: "desc" },
      select: { bestFinalScore: true, user: { select: { id: true, name: true } } },
    }),
  ]);
  if (!keyword) return { summary: "没有找到该关键词。", data: { found: false } };
  const keywordEntity = { id: keyword.id, name: keyword.term };
  const subject = { id: keyword.chapter.subject.id, name: keyword.chapter.subject.title };
  const avgScore = Math.round((agg._avg.bestFinalScore ?? 0) * 10) / 10;
  return {
    summary: `「${keyword.term}」全员完成人数 ${agg._count._all}，平均分 ${avgScore}。`,
    data: {
      found: true,
      keyword: keywordEntity,
      subject,
      chapterIndex: keyword.chapter.index,
      completedCount: agg._count._all,
      avgScore,
      minScore: agg._min.bestFinalScore,
      maxScore: agg._max.bestFinalScore,
      completedLearners: rows.map((row) => ({
        learner: { id: row.user.id, name: row.user.name },
        score: row.bestFinalScore,
      })),
      topRecords: rows.slice(0, 8).map((row) => ({
        learner: { id: row.user.id, name: row.user.name },
        score: row.bestFinalScore,
      })),
    },
    contextWrites: { keyword: keywordEntity, subject, learner: ctx.learningContext.learner },
  };
}

async function getKeywordCompletionLearners(
  input: unknown,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const names = extractKeywordIdentifiers(input);
  if (names.length === 0) {
    return { summary: "需要先说明要查哪些关键词的完成人名单。", data: { found: false } };
  }

  const results: Record<string, unknown>[] = [];
  const ambiguities: Record<string, unknown>[] = [];
  for (const name of names.slice(0, 6)) {
    const resolved = await resolveKeyword({ keyword: name }, ctx);
    if (!resolved.contextWrites?.keyword) {
      if ((resolved.data as { ambiguous?: boolean }).ambiguous) {
        ambiguities.push({ requested: name, candidates: (resolved.data as { candidates?: unknown }).candidates });
      } else {
        results.push({ requested: name, found: false, reason: resolved.summary });
      }
      continue;
    }
    const analytics = await getKeywordAnalytics(
      { keywordId: resolved.contextWrites.keyword.id },
      { ...ctx, learningContext: { ...ctx.learningContext, ...resolved.contextWrites } },
    );
    results.push({ requested: name, ...(analytics.data as Record<string, unknown>) });
  }

  if (ambiguities.length > 0) {
    return {
      summary: "部分关键词存在多个候选，需要用户确认后才能查询完成人名单。",
      data: { found: false, ambiguous: true, ambiguities, results },
    };
  }

  const summary = results
    .map((result) => {
      if (!result.found) return `「${result.requested}」未找到数据`;
      const keyword = result.keyword as AssistantEntityRef;
      const completedCount = result.completedCount as number;
      const avgScore = result.avgScore as number;
      return `「${keyword.name}」${completedCount} 人完成，平均分 ${avgScore}`;
    })
    .join("；");

  return {
    summary,
    data: { found: true, results },
    contextWrites: ctx.learningContext,
  };
}

async function getAdminInsights(includePeople: boolean): Promise<AssistantToolResult> {
  const [finance, grouped, activeSubjects, people] = await Promise.all([
    getFinanceStats(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.subject.count({ where: { isActive: true, archivedAt: null } }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { name: true, role: true, isActivated: true },
    }),
  ]);
  const employeeCount =
    grouped.find((row) => row.role === "EMPLOYEE")?._count._all ?? 0;
  const adminCount =
    (grouped.find((row) => row.role === "ADMIN")?._count._all ?? 0) +
    (grouped.find((row) => row.role === "SUPERADMIN")?._count._all ?? 0);
  const employees = people.filter((u) => u.role === "EMPLOYEE").map((u) => u.name);
  const admins = people.filter((u) => u.role !== "EMPLOYEE").map((u) => u.name);
  const summary = includePeople
    ? `当前员工 ${employeeCount} 人，管理员 ${adminCount} 人。\n员工：${employees.join("、") || "无"}。\n管理员：${admins.join("、") || "无"}。`
    : `当前员工 ${employeeCount} 人，管理员 ${adminCount} 人；上线学科 ${activeSubjects} 个，待审批兑换 ${finance.pendingCount} 笔（${finance.pendingAmount} 积分），全平台已发放 ${finance.issued} 积分。`;
  return {
    summary,
    data: { finance, users: grouped, activeSubjects, employeeCount, adminCount, employees, admins },
    navigation: [
      { label: "管理后台", href: "/admin" },
      { label: "兑换审批", href: "/admin/redemptions" },
      { label: "数据统计", href: "/admin/stats" },
    ],
  };
}

async function getKeywordCoachHint(
  userId: string,
  page: AssistantPageContext,
): Promise<AssistantToolResult> {
  if (page.submissionId) {
    const submission = await prisma.submission.findFirst({
      where: { id: page.submissionId, userId },
      include: { keyword: { select: { id: true, term: true } } },
    });
    if (submission) {
      return {
        summary: `我已识别到你正在复盘「${submission.keyword.term}」。这个入口会优先结合你自己的笔记和追问记录继续辅导。`,
        data: { submissionId: submission.id, keywordId: submission.keyword.id },
        navigation: [{ label: "回到该关键词", href: `/learn/keyword/${submission.keyword.id}` }],
      };
    }
  }
  const latest = await prisma.submission.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    include: { keyword: { select: { id: true, term: true } } },
  });
  if (!latest) {
    return {
      summary: "你还没有完成过关键词。先完成一个词后，我就能结合你的笔记继续辅导。",
      data: null,
      navigation: [{ label: "去闯关地图", href: "/learn" }],
    };
  }
  return {
    summary: `最近一次完成的是「${latest.keyword.term}」。你可以进入结果页继续向 AI 追问。`,
    data: { submissionId: latest.id, keywordId: latest.keyword.id },
    navigation: [{ label: "继续复盘", href: `/learn/keyword/${latest.keyword.id}` }],
  };
}

async function getPeerSummary(
  userId: string,
  page: AssistantPageContext,
): Promise<AssistantToolResult> {
  if (!page.keywordId) {
    return {
      summary: "我需要先知道你想看哪个关键词的同伴记录。进入某个关键词结果页后再问我会更准确。",
      data: null,
      navigation: [{ label: "去闯关地图", href: "/learn" }],
    };
  }
  const peers = await getPeerNotes(userId, page.keywordId);
  if (peers === null) {
    return {
      summary: "这个关键词的同伴笔记还没解锁。你完成本词后，我才能帮你摘要别人优秀记录的结构和思路。",
      data: { unlocked: false },
    };
  }
  if (peers.length === 0) {
    return {
      summary: "你已经解锁了这个关键词，但目前还没有其他同事的记录可参考。",
      data: { unlocked: true, peers: [] },
    };
  }
  const lines = peers.map((peer, index) => {
    const firstFollowup = peer.followups[0]?.question;
    return `${index + 1}. ${peer.name}（${peer.score} 分）：笔记约 ${peer.note.length} 字，结构上覆盖了概念说明与个人理解${firstFollowup ? `；追问聚焦「${firstFollowup.slice(0, 28)}…」` : ""}。`;
  });
  return {
    summary: `已按防抄袭规则读取你已解锁的同伴记录。可参考的写法特点：\n${lines.join("\n")}`,
    data: { unlocked: true, count: peers.length },
  };
}

export function selectSkills(
  message: string,
  page: AssistantPageContext,
  history: AssistantHistoryMessage[] = [],
): AssistantSkill[] {
  const text = normalize(message);
  return assistantSkills.filter((skill) =>
    skill.tools.some((tool) => tool.match(text, page, history)),
  );
}

export const assistantSkills: AssistantSkill[] = [
  {
    name: "learning-progress",
    description: "查询学习进度、章节解锁、待办与每日上限。",
    permission: "USER",
    tools: [
      {
        name: "getLearningProgress",
        description: "查询当前用户学习进度。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) =>
          hasAny(message, ["进度", "学到", "待办", "章节", "闯关", "上限", "今天"]),
        execute: async (_input, ctx) => getLearningProgress(ctx.user.id),
      },
    ],
  },
  {
    name: "personal-account",
    description: "查询积分、余额、待审批占用与兑换规则。",
    permission: "USER",
    tools: [
      {
        name: "getPersonalAccount",
        description: "查询当前用户积分账户。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) => hasAny(message, ["积分", "余额", "兑换", "报销", "流水"]),
        execute: async (_input, ctx) => getPersonalAccount(ctx.user.id),
      },
    ],
  },
  {
    name: "redemption",
    description: "把自然语言兑换意图整理成确认卡片。",
    permission: "USER",
    tools: [
      {
        name: "draftRedemption",
        description: "生成兑换申请确认卡，不直接提交。",
        permission: "USER",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "用户原始兑换意图，例如：帮我兑换一本书 80 元" },
          },
          required: ["text"],
          additionalProperties: false,
        },
        match: (message) => hasAny(message, ["兑换", "报销", "申请"]) && parseRedemptionDraft(message) != null,
        execute: async (_input, ctx) => {
          const draft = parseRedemptionDraft(inputText(_input)) as RedemptionDraft;
          return draftRedemption(ctx.user.id, draft);
        },
        summarizeInput: (input) => ({ text: inputText(input).slice(0, 80) }),
        summarizeResult: (result) => ({
          summary: result.summary,
          confirmation: result.confirmation satisfies AssistantConfirmation | undefined,
        }),
      },
    ],
  },
  {
    name: "keyword-coach",
    description: "识别当前关键词上下文，引导用户继续复盘。",
    permission: "USER",
    tools: [
      {
        name: "getKeywordCoachHint",
        description: "查询当前或最近关键词复盘入口。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message, page) =>
          Boolean(page.submissionId || page.keywordId) ||
          hasAny(message, ["复盘", "关键词", "笔记", "追问", "辅导", "讲讲"]),
        execute: async (_input, ctx) => getKeywordCoachHint(ctx.user.id, ctx.page),
      },
    ],
  },
  {
    name: "peer-summary",
    description: "摘要已解锁关键词范围内的同伴记录。",
    permission: "USER",
    tools: [
      {
        name: "getPeerSummary",
        description: "按同伴可见性规则摘要同伴记录。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message, page) =>
          Boolean(page.keywordId) && hasAny(message, ["别人", "同伴", "同事", "怎么写", "参考"]),
        execute: async (_input, ctx) => getPeerSummary(ctx.user.id, ctx.page),
      },
    ],
  },
  {
    name: "admin-insights",
    description: "管理员只读运营概览。",
    permission: "ADMIN",
    tools: [
      {
        name: "getAdminInsights",
        description: "查询后台只读概览。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            includePeople: { type: "boolean", description: "用户是否要求列出具体人员名单" },
          },
          additionalProperties: false,
        },
        match: (message, _page, history) =>
          hasAny(message, ["后台", "管理", "审批", "统计", "运营", "员工", "预算"]) ||
          refersToPreviousPeople(message, history),
        execute: async (input, ctx) =>
          getAdminInsights(inputBool(input, "includePeople") ?? wantsPeopleList(inputText(input), ctx.history)),
      },
    ],
  },
  {
    name: "admin-learner-detail",
    description: "管理员学情分析：先解析员工/关键词实体，再按意图组合查询员工概览、完成题目、个人关键词得分、关键词全员统计。",
    permission: "ADMIN",
    tools: [
      {
        name: "resolveLearner",
        description: "把员工姓名、登录名或手机号解析为员工实体，并写入会话上下文。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "员工姓名，例如：张三" },
            loginName: { type: "string", description: "员工登录名，可选" },
            phone: { type: "string", description: "员工手机号，可选" },
          },
          additionalProperties: false,
        },
        match: (message) => /张三|李四|王五|赵六|员工|学员|用户/.test(message),
        execute: async (input) => resolveLearner(input),
        summarizeInput: (input) => ({ identifier: extractLearnerIdentifier(input) }),
        summarizeResult: (result) => ({ summary: result.summary, contextWrites: result.contextWrites }),
      },
      {
        name: "resolveKeyword",
        description: "查询关键词候选并解析为关键词实体；如有多个候选，返回歧义候选让 AI 反问用户确认，不擅自绑定。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "关键词名称，例如：图灵机" },
          },
          required: ["keyword"],
          additionalProperties: false,
        },
        match: (message) => hasAny(message, ["关键词", "图灵机", "人工智能", "高频qrs", "高频QRS"]),
        execute: async (input, ctx) => resolveKeyword(input, ctx),
        summarizeInput: (input) => ({ keyword: extractKeywordIdentifier(input) }),
        summarizeResult: (result) => ({ summary: result.summary, contextWrites: result.contextWrites }),
      },
      {
        name: "getAdminLearnerDetail",
        description: "兼容旧入口：解析员工并查询员工 360° 概览。新问题优先使用 getLearnerOverview 等小工具。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "员工姓名，例如：张三" },
            loginName: { type: "string", description: "员工登录名，可选" },
            phone: { type: "string", description: "员工手机号，可选" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["数据", "学情", "画像", "学习情况", "答题", "记录"]) &&
          /(?:的|员工|学员|用户)/.test(message),
        execute: async (input, ctx) => getAdminLearnerDetail(input, ctx),
        summarizeInput: (input) => ({ identifier: extractLearnerIdentifier(input) }),
        summarizeResult: (result) => ({
          summary: result.summary,
          found: Boolean((result.data as { found?: boolean } | null)?.found),
        }),
      },
      {
        name: "getLearnerOverview",
        description: "查询当前或指定员工的概览：资料、学科进度、钱包、画像、最近记录。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            learnerId: { type: "string", description: "员工 id；若已解析员工，可省略" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["数据", "学情", "画像", "学习情况", "进度", "钱包"]) &&
          /(?:的|员工|学员|用户|他|她)/.test(message),
        execute: async (input, ctx) => getAdminLearnerOverview(input, ctx),
        summarizeInput: (input) => ({ learnerId: inputString(input, ["learnerId", "userId"]) }),
        summarizeResult: (result) => ({ summary: result.summary, contextWrites: result.contextWrites }),
      },
      {
        name: "listLearnerKeywordRecords",
        description: "列出当前或指定员工已完成的关键词题目、每题分数、个人完成记录均分。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            learnerId: { type: "string", description: "员工 id；若已解析员工，可省略" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["完成了哪些", "哪些题", "哪些关键词", "哪些数据", "有数据", "题目", "每题", "平均分", "均分"]) &&
          !hasAny(message, ["这个关键词", "该关键词"]),
        execute: async (input, ctx) => listLearnerKeywordRecords(input, ctx),
        summarizeResult: (result) => ({
          summary: result.summary,
          count: (result.data as { count?: number } | null)?.count,
          contextWrites: result.contextWrites,
        }),
      },
      {
        name: "getLearnerKeywordRecord",
        description: "查询当前员工在某个关键词上的个人最终分、笔记反馈和追问记录。适合问“张三图灵机多少分”。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            learnerId: { type: "string", description: "员工 id；若已解析员工，可省略" },
            keywordId: { type: "string", description: "关键词 id；若已解析关键词，可省略" },
            keyword: { type: "string", description: "关键词名称，例如：图灵机" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["多少分", "得分", "分数", "平均分", "均分"]) &&
          hasAny(message, ["关键词", "图灵机", "人工智能", "高频qrs", "高频QRS"]),
        execute: async (input, ctx) => getLearnerKeywordRecord(input, ctx),
        summarizeResult: (result) => ({
          summary: result.summary,
          found: (result.data as { found?: boolean } | null)?.found,
          contextWrites: result.contextWrites,
        }),
      },
      {
        name: "getKeywordAnalytics",
        description: "查询某关键词的全员统计：完成人数、平均分、最高/最低分、Top 记录。适合问“这个关键词平均分是多少”。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            keywordId: { type: "string", description: "关键词 id；若已解析关键词，可省略" },
            keyword: { type: "string", description: "关键词名称，例如：图灵机" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["平均分", "均分", "全员", "整体", "大家"]) &&
          hasAny(message, ["关键词", "图灵机", "人工智能", "高频qrs", "高频QRS"]),
        execute: async (input, ctx) => getKeywordAnalytics(input, ctx),
        summarizeResult: (result) => ({
          summary: result.summary,
          avgScore: (result.data as { avgScore?: number } | null)?.avgScore,
          contextWrites: result.contextWrites,
        }),
      },
      {
        name: "getKeywordCompletionLearners",
        description: "查询一个或多个关键词分别有哪些员工完成、各自分数、完成人数和平均分；如关键词名称有歧义则返回候选让 AI 反问确认。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "关键词名称列表，例如：[\"人工智能\", \"达特茅斯会议\"]",
            },
          },
          required: ["keywords"],
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["哪些人完成", "谁完成", "完成人", "完成名单"]) &&
          hasAny(message, ["关键词", "人工智能", "达特茅斯", "图灵", "高频qrs", "高频QRS"]),
        execute: async (input, ctx) => getKeywordCompletionLearners(input, ctx),
        summarizeResult: (result) => ({
          summary: result.summary,
          ambiguous: (result.data as { ambiguous?: boolean } | null)?.ambiguous,
        }),
      },
    ],
  },
  {
    name: "automation-draft",
    description: "未来后台自动任务的确认草案占位，不创建任务。",
    permission: "USER",
    tools: [
      {
        name: "draftReminder",
        description: "生成提醒任务草案，但不落库、不调度。",
        permission: "USER",
        parameters: {
          type: "object",
          properties: { text: { type: "string", description: "用户原始提醒需求" } },
          required: ["text"],
          additionalProperties: false,
        },
        match: (message) => hasAny(message, ["提醒", "每天", "每周", "自动任务", "通知"]),
        execute: async (input) => {
          const draft = buildReminderDraft(inputText(input));
          return {
            summary:
              "我可以先整理提醒任务草案，但当前版本还没有启用后台调度。未来会在你确认后创建任务。",
            data: { draft },
            confirmation: draft,
          };
        },
      },
    ],
  },
];
