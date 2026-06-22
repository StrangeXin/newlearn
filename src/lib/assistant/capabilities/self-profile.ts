import { getLearnerDetail } from "@/lib/stats";
import type { AssistantSkill, AssistantToolResult } from "@/lib/assistant/types";
import type { AssistantCapabilityProvider } from "./registry";

function hasAny(message: string, words: string[]) {
  return words.some((word) => message.includes(word.toLowerCase()));
}

async function getSelfOverview(user: { id: string; name: string; role: string }): Promise<AssistantToolResult> {
  const userId = user.id;
  const detail = await getLearnerDetail(userId);
  if (!detail) {
    return {
      summary: "没有读取到你的资料。请先完成 onboarding。",
      data: { found: false },
      navigation: [{ label: "完善资料", href: "/onboarding" }],
    };
  }
  const completed = detail.subjects.reduce((sum, subject) => sum + subject.completed, 0);
  return {
    summary: `你是「${detail.name}」，当前角色是 ${user.role}。累计完成 ${completed} 个关键词，积分余额 ${detail.wallet.balance}。`,
    data: {
      found: true,
      user: { id: detail.userId, name: detail.name, isActivated: detail.isActivated },
      role: user.role,
      wallet: detail.wallet,
      subjects: detail.subjects,
      completed,
    },
    navigation: [
      { label: "我的资料", href: "/profile" },
      { label: "学习地图", href: "/learn" },
    ],
  };
}

async function getSelfProfile(userId: string): Promise<AssistantToolResult> {
  const detail = await getLearnerDetail(userId);
  if (!detail?.profile) {
    return {
      summary: "你还没有填写基本资料。",
      data: { found: false },
      navigation: [{ label: "完善资料", href: "/onboarding" }],
    };
  }
  const profile = detail.profile;
  return {
    summary: `你的基本资料：${profile.department || "未填部门"} / ${profile.position || "未填岗位"} / ${profile.level || "未填职级年限"}。专业背景：${profile.background || "未填"}。AI 熟悉度：${profile.aiFamiliarity || "未填"}。想用 AI 做：${profile.applicationAreas || "未填"}。`,
    data: {
      found: true,
      user: { id: detail.userId, name: detail.name },
      profile,
    },
    navigation: [{ label: "编辑我的资料", href: "/profile" }],
  };
}

async function getSelfPortrait(userId: string): Promise<AssistantToolResult> {
  const detail = await getLearnerDetail(userId);
  if (!detail) {
    return {
      summary: "没有读取到你的资料。请先完成 onboarding。",
      data: { found: false },
      navigation: [{ label: "完善资料", href: "/onboarding" }],
    };
  }
  if (!detail.memory || detail.memory.updateCount === 0) {
    return {
      summary: "你还没有形成学习画像。通过第一个关键词后，系统会根据作答生成画像。",
      data: { found: false, hasPortrait: false },
      navigation: [{ label: "去闯关", href: "/learn" }],
    };
  }
  const tags = detail.memory.tags;
  const weaknesses = [...tags.weaknesses, ...tags.blindSpots];
  return {
    summary: `你的学习画像已更新 ${detail.memory.updateCount} 次。掌握强项：${tags.strengths.join("、") || "暂无"}。待加强/盲区：${weaknesses.join("、") || "暂无"}。兴趣方向：${tags.interests.join("、") || "暂无"}。`,
    data: {
      found: true,
      user: { id: detail.userId, name: detail.name },
      memory: detail.memory,
      latestSnapshot: detail.snapshots.at(-1) ?? null,
    },
    navigation: [
      { label: "查看我的资料", href: "/profile" },
      { label: "成长轨迹", href: "/growth" },
    ],
  };
}

export const selfProfileSkills: AssistantSkill[] = [
  {
    name: "self-profile",
    description: "查询当前登录用户自己的身份、基本资料与学习画像。复用个人资料/成长轨迹同源数据。",
    permission: "USER",
    tools: [
      {
        name: "getSelfOverview",
        description: "回答“我是谁”：当前登录用户身份、角色、积分与学习概览。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) => hasAny(message, ["我是谁", "我是誰", "我是什么角色", "我的身份"]),
        execute: async (_input, ctx) => getSelfOverview(ctx.user),
      },
      {
        name: "getSelfProfile",
        description: "查询当前登录用户在“我的资料”页填写的基本资料。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) => hasAny(message, ["我的资料", "我的信息", "个人资料", "基本资料"]),
        execute: async (_input, ctx) => getSelfProfile(ctx.user.id),
      },
      {
        name: "getSelfPortrait",
        description: "查询当前登录用户的学习画像、标签、强项、待加强和兴趣方向。",
        permission: "USER",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        match: (message) => hasAny(message, ["我的画像", "学习画像", "画像是啥", "画像是什么", "强项", "待加强", "盲区"]),
        execute: async (_input, ctx) => getSelfPortrait(ctx.user.id),
      },
    ],
  },
];

export const selfProfileCapabilityProvider: AssistantCapabilityProvider = {
  id: "self-profile",
  description: "Current-user profile and portrait capability backed by profile/growth services.",
  getSkills: () => selfProfileSkills,
};
