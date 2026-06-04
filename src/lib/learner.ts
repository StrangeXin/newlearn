import { prisma } from "@/lib/db";
import {
  EMPTY_TAGS,
  type LearnerContext,
  type LearnerMemoryTags,
} from "@/lib/scoring";

/** 把存库的 Json 标签安全解析为结构化标签（缺字段回退空数组）。 */
function parseTags(value: unknown): LearnerMemoryTags {
  const v = (value ?? {}) as Record<string, unknown>;
  const arr = (x: unknown): string[] =>
    Array.isArray(x) ? x.map((i) => String(i)).filter((s) => s.trim()) : [];
  return {
    strengths: arr(v.strengths),
    weaknesses: arr(v.weaknesses),
    interests: arr(v.interests),
    blindSpots: arr(v.blindSpots),
  };
}

/** 组装某用户的学习者上下文（资料 + 记忆），供打分服务个性化使用。 */
export async function getLearnerContext(userId: string): Promise<LearnerContext> {
  const [profile, memory] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId } }),
    prisma.employeeMemory.findUnique({ where: { userId } }),
  ]);

  return {
    profile: profile
      ? {
          position: profile.position,
          department: profile.department,
          level: profile.level,
          background: profile.background,
          aiFamiliarity: profile.aiFamiliarity,
          applicationAreas: profile.applicationAreas,
        }
      : undefined,
    memory: memory
      ? { tags: parseTags(memory.tags), portrait: memory.portrait }
      : undefined,
  };
}

export { EMPTY_TAGS };
