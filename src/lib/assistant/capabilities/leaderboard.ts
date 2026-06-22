import { getChapterWinners, getLeaderboard, getPointsLeaderboard } from "@/lib/social";
import { getActiveSubjects } from "@/lib/subject";
import type { AssistantSkill, AssistantToolResult } from "@/lib/assistant/types";
import type { AssistantCapabilityProvider } from "./registry";

function hasAny(message: string, words: string[]) {
  return words.some((word) => message.includes(word.toLowerCase()));
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

function inputString(input: unknown, keys: string[]): string {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
  }
  return "";
}

async function getLeaderboardSnapshot(input: unknown): Promise<AssistantToolResult> {
  const text = inputText(input);
  const subjects = await getActiveSubjects();
  const requestedSubject = inputString(input, ["subject", "subjectTitle"]);
  const subject =
    subjects.find((s) => s.id === inputString(input, ["subjectId"])) ??
    subjects.find((s) => requestedSubject && s.title.includes(requestedSubject)) ??
    subjects.find((s) => text.includes(s.title)) ??
    subjects[0];

  const [pointsBoard, subjectBoards, winners] = await Promise.all([
    getPointsLeaderboard(20),
    Promise.all(subjects.map(async (s) => ({ subject: s, rows: await getLeaderboard(s.id, 20) }))),
    subject ? getChapterWinners(subject.id) : Promise.resolve([]),
  ]);

  const subjectBoard = subjectBoards.find((board) => board.subject.id === subject?.id) ?? subjectBoards[0];
  const completedPeople = [...new Set(subjectBoards.flatMap((board) => board.rows.map((row) => row.name)))];
  const boardLines = subjectBoards
    .map((board) => {
      const names = board.rows.map((row) => `${row.name}（通过 ${row.completed} 个，均分 ${row.avgScore.toFixed(1)}）`);
      return `${board.subject.title}：${names.join("、") || "暂无上榜"}`;
    })
    .join("；");
  const summary = subjectBoard
    ? `当前全平台各学习榜去重后可查到 ${completedPeople.length} 名已通过至少 1 个关键词的上榜员工。注意：这里的“通过/通关”指关键词通过，不等于完成整章或全学科。各学科榜：${boardLines}。`
    : "当前排行榜还没有上榜数据。";

  return {
    summary,
    data: {
      pointsBoard,
      metricDefinition: "学习榜上榜条件是通过至少 1 个关键词；completed 是已通过关键词数，不代表整章或全学科通关。",
      completedPeople,
      subjectBoards: subjectBoards.map((board) => ({
        subject: { id: board.subject.id, title: board.subject.title },
        rows: board.rows,
      })),
      activeSubject: subjectBoard
        ? { id: subjectBoard.subject.id, title: subjectBoard.subject.title, rows: subjectBoard.rows }
        : null,
      chapterWinners: winners,
    },
    contextWrites: subject ? { subject: { id: subject.id, name: subject.title } } : undefined,
    navigation: [
      { label: "查看排行榜", href: "/leaderboard" },
      { label: "章节排名", href: "/admin/rankings" },
    ],
  };
}

async function getChapterRankingSnapshot(input: unknown): Promise<AssistantToolResult> {
  const text = inputText(input);
  const subjects = await getActiveSubjects();
  const requestedSubject = inputString(input, ["subject", "subjectTitle"]);
  const subject =
    subjects.find((s) => s.id === inputString(input, ["subjectId"])) ??
    subjects.find((s) => requestedSubject && s.title.includes(requestedSubject)) ??
    subjects.find((s) => text.includes(s.title)) ??
    subjects[0];
  if (!subject) {
    return { summary: "当前没有已上线学科，无法查询章节排名。", data: { found: false } };
  }
  const winners = await getChapterWinners(subject.id);
  return {
    summary: winners.length
      ? `${subject.title} 已结算章节冠军：${winners.map((chapter) => `第${chapter.chapterIndex}章 ${chapter.winners.map((winner) => `${winner.name} 第${winner.rank}名`).join("、")}`).join("；")}`
      : `${subject.title} 还没有已结算的章节排名。`,
    data: { found: true, subject: { id: subject.id, title: subject.title }, winners },
    contextWrites: { subject: { id: subject.id, name: subject.title } },
    navigation: [{ label: "章节排名", href: "/admin/rankings" }],
  };
}

async function getPointsLeaderboardSnapshot(): Promise<AssistantToolResult> {
  const pointsBoard = await getPointsLeaderboard(20);
  return {
    summary: pointsBoard.length
      ? `积分总榜当前 ${pointsBoard.length} 人上榜：${pointsBoard.map((row, index) => `${index + 1}. ${row.name}（${row.earned} 分，通关 ${row.base}，排名奖 ${row.bonus}）`).join("；")}`
      : "积分总榜暂无上榜人员。",
    data: { pointsBoard },
    navigation: [{ label: "查看排行榜", href: "/leaderboard" }],
  };
}

export const leaderboardSkills: AssistantSkill[] = [
  {
    name: "leaderboard",
    description: "查询排行榜、积分总榜、学习榜、已通关上榜人员、章节排名与各章冠军。复用页面同源服务函数。",
    permission: "USER",
    tools: [
      {
        name: "getLeaderboardSnapshot",
        description: "查询排行榜快照：积分总榜、各学科学习榜、哪些员工已通关过关键词并上榜。",
        permission: "USER",
        parameters: {
          type: "object",
          properties: {
            subjectId: { type: "string", description: "学科 id，可选" },
            subject: { type: "string", description: "学科名称，可选，例如：人工智能（专业版）" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["排行榜", "学习榜", "上榜", "通关", "通过", "哪些人过", "哪些人通关"]),
        execute: async (input) => getLeaderboardSnapshot(input),
        summarizeResult: (result) => ({
          summary: result.summary,
          completedPeople: (result.data as { completedPeople?: string[] } | null)?.completedPeople,
        }),
      },
      {
        name: "getChapterRankingSnapshot",
        description: "查询已结算章节排名和各章冠军；适合问本周排名、章节排名、前 3 名、+100 奖励。",
        permission: "ADMIN",
        parameters: {
          type: "object",
          properties: {
            subjectId: { type: "string", description: "学科 id，可选" },
            subject: { type: "string", description: "学科名称，可选" },
          },
          additionalProperties: false,
        },
        match: (message) =>
          hasAny(message, ["章节排名", "各章冠军", "冠军", "前3", "前 3", "+100", "排名奖励", "本周排名"]),
        execute: async (input) => getChapterRankingSnapshot(input),
      },
      {
        name: "getPointsLeaderboardSnapshot",
        description: "查询积分总榜：累计获得、通关基础分、排名奖励。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) => hasAny(message, ["积分总榜", "积分榜", "谁积分", "积分最多"]),
        execute: async () => getPointsLeaderboardSnapshot(),
      },
    ],
  },
];

export const leaderboardCapabilityProvider: AssistantCapabilityProvider = {
  id: "leaderboard",
  description: "Leaderboard page capability provider backed by social service query APIs.",
  getSkills: () => leaderboardSkills,
};
