import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// ============================================================================
// 学科装配助手（多活跃学科）
// ----------------------------------------------------------------------------
// 平台可同时上线多个学习主题。「对员工上线（可见且可学）」= isActive && 未归档。
// 各学科的 startDate 独立，驱动各自的自然周解锁。早期的 ActiveSubjectConfig 单例
// （全公司至多一个活跃学科）已废弃，统一改用这里的助手 / 过滤常量取学科。
//
// 需要 include 关联（章节、计数等）的页面，直接用下面的 ACTIVE_SUBJECT_WHERE /
// SUBJECT_ORDER 自行 findMany/findFirst，以保留 Prisma 的精确返回类型推断。
// ============================================================================

/** 「对员工上线」的过滤条件：已激活且未归档。 */
export const ACTIVE_SUBJECT_WHERE = {
  isActive: true,
  archivedAt: null,
} satisfies Prisma.SubjectWhereInput;

/** 学科稳定排序：先按开课日（未开课排后），再按创建时间。 */
export const SUBJECT_ORDER: Prisma.SubjectOrderByWithRelationInput[] = [
  { startDate: "asc" },
  { createdAt: "asc" },
];

/** 管理后台学科排序：不受开始日调整影响，避免周切换按钮点击后卡片跳位。 */
export const SUBJECT_MANAGEMENT_ORDER: Prisma.SubjectOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

/** 员工可见的学科展示排序：入门/普及在前，专业/进阶在后，其余保持原有稳定顺序。 */
export function sortSubjectsForLearners<T extends { title: string }>(subjects: T[]) {
  const rank = (title: string) =>
    title.includes("普及版") ? 0 : title.includes("专业版") ? 1 : 2;
  return [...subjects].sort((a, b) => rank(a.title) - rank(b.title));
}

/** 取所有对员工上线的学科（不含关联），按稳定顺序返回。 */
export async function getActiveSubjects() {
  const subjects = await prisma.subject.findMany({
    where: ACTIVE_SUBJECT_WHERE,
    orderBy: SUBJECT_ORDER,
  });
  return sortSubjectsForLearners(subjects);
}

/**
 * 取单个「对员工上线」的学科；若 id 不存在或学科未上线/已归档则返回 null。
 * 用于校验路由里的 subjectId 合法且当前可学。
 */
export function getActiveSubjectById(id: string) {
  return prisma.subject.findFirst({
    where: { id, ...ACTIVE_SUBJECT_WHERE },
  });
}
