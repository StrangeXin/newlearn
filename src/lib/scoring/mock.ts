// ===========================================================================
// src/lib/scoring/mock.ts
// MockScoringService —— 完全确定性的打分实现，用于自动化测试与本地演示。
//
// 严格约束：
//   * 禁止使用任何随机源（Math.random 等）。
//   * 禁止读取当前时间（Date / Date.now / performance.now / process.hrtime 等时钟 API）。
//   * 同样的输入永远产生同样的输出，可被快照测试断言。
//
// 算分思路（与 PRD §6.1 rubric 对齐的可重复启发式）：
//   - 初始分由「笔记长度 / 参考要点覆盖度 / 结构信号」三部分确定性合成。
//   - 追问数量按笔记质量确定性地取 1~3（笔记越完整问得越少）。
//   - 最终分在初始分基础上，按每条追问回答的长度质量确定性微调。
// ===========================================================================

import {
  EMPTY_TAGS,
  FinalizeInput,
  FinalizeResult,
  Keyword,
  LearnerMemoryTags,
  PASS_THRESHOLD,
  ReflectionQuestionsInput,
  ReflectionSummaryInput,
  ReflectionSummaryResult,
  RUBRIC_DIMENSIONS,
  ScoringService,
  SubmitNoteInput,
  SubmitNoteResult,
  UpdateMemoryInput,
  UpdateMemoryResult,
} from "./types";

/** 将任意数值收敛到 1–100 的整数。 */
function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** 文本长度按「去除首尾空白后的字符数」计，确定性且与展示口径一致。 */
function textLength(text: string): number {
  return text.trim().length;
}

/**
 * 统计笔记对参考考核要点的覆盖度。
 * 启发式：对每个参考要点，按非字母数字/汉字切分出「词元」，
 * 只要笔记（小写归一后）包含其中任意词元，即视为该要点被覆盖。
 * 完全确定性，不依赖任何外部状态。
 */
function coverageRatio(note: string, referencePoints?: string[]): number {
  if (!referencePoints || referencePoints.length === 0) {
    // 无参考要点时，给一个中性的覆盖度（既不奖励也不惩罚）。
    return 0.6;
  }
  const haystack = note.toLowerCase();
  let hit = 0;
  for (const point of referencePoints) {
    const tokens = point
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 2);
    const covered =
      tokens.length === 0
        ? haystack.includes(point.trim().toLowerCase())
        : tokens.some((t) => haystack.includes(t));
    if (covered) hit += 1;
  }
  return hit / referencePoints.length;
}

/**
 * 计算初始分。各部分上限之和略低于 100，使「满分」需要又长又全又有结构，
 * 与 rubric 的「完整性 / 条理性」直觉一致。
 *   base 18 + length≤38 + coverage≤32 + structure≤12
 */
function computeInitialScore(note: string, keyword: Keyword): number {
  const len = textLength(note);

  // 基础分（体现「认真提交了」的下限）。
  const base = 18;

  // 长度分：100 字起步、约 4000 字饱和，最高 38。
  const lengthScore = Math.min(38, Math.round((len / 4000) * 38));

  // 覆盖分：参考要点覆盖度 × 32（无参考要点时为中性 0.6 × 32 ≈ 19）。
  const coverageScore = Math.round(
    coverageRatio(note, keyword.referencePoints) * 32,
  );

  // 结构分：用换行段落 + 句号等可重复信号近似「条理性」，最高 12。
  const paragraphs = note.split(/\n+/).filter((p) => p.trim().length > 0).length;
  const sentences = note
    .split(/[。！？.!?]/)
    .filter((s) => s.trim().length > 0).length;
  const structureScore = Math.min(12, paragraphs * 2 + Math.min(6, sentences));

  return clampScore(base + lengthScore + coverageScore + structureScore);
}

/**
 * 追问数量：笔记越好问得越少（PRD §6 步骤 4）。
 *   initialScore >= 80           → 1 个
 *   60 <= initialScore < 80      → 2 个
 *   initialScore < 60            → 3 个
 */
function followupCountFor(initialScore: number): 1 | 2 | 3 {
  if (initialScore >= 80) return 1;
  if (initialScore >= PASS_THRESHOLD) return 2;
  return 3;
}

/**
 * 确定性地生成追问文案。问题池按「应优先补强的薄弱点」排序，取前 N 个。
 * 单个关键词的追问只考查对该词本身的理解；「结合岗位」类问题放到章节总结环节。
 */
function buildFollowups(term: string, count: 1 | 2 | 3): string[] {
  const pool = [
    `请进一步说明「${term}」的核心原理或运作机制，而不仅是定义。`,
    `能否举一个「${term}」的具体应用场景或实例，并解释它为什么适用？`,
    `「${term}」有哪些局限、风险或常见误区？请结合你的理解谈谈。`,
  ];
  return pool.slice(0, count);
}

/**
 * 单条追问回答的质量分（确定性，仅看去空白后的长度）。
 *   空作答：-7（明显失分）
 *   过短（<20）：+1
 *   适中（20–79）：+4
 *   充分（>=80）：+7
 */
function answerAdjustment(answer: string): number {
  const len = textLength(answer);
  if (len === 0) return -7;
  if (len < 20) return 1;
  if (len < 80) return 4;
  return 7;
}

/** 生成中文反馈（确定性，依据最终分分档 + 是否有空答）。 */
function buildFeedback(
  finalScore: number,
  passed: boolean,
  hasBlankAnswer: boolean,
): string {
  const head = passed
    ? `恭喜，本关键词最终得分 ${finalScore} 分，已达到及格线（${PASS_THRESHOLD} 分），记 1 积分。`
    : `本关键词最终得分 ${finalScore} 分，未达到及格线（${PASS_THRESHOLD} 分），可重新提交笔记再次挑战，系统取历史最高分。`;

  let detail: string;
  if (finalScore >= 85) {
    detail = "笔记内容详实、覆盖要点全面且有自己的思考，继续保持。";
  } else if (finalScore >= PASS_THRESHOLD) {
    detail =
      "整体表现不错，但在概念深度或要点完整性上仍有提升空间，可补充原理细节与实例。";
  } else {
    detail =
      "建议补充对核心要点的覆盖、加强对原理与机制的阐述，并适当延展篇幅与结构。";
  }

  const tail = hasBlankAnswer
    ? " 注意：部分追问未作答，已影响最终评分，建议逐条认真回答。"
    : "";
  return head + detail + tail;
}

/**
 * 完全确定性的 Mock 打分服务。
 * 不使用随机数、不读取时间，任何相同输入都得到相同输出。
 */
export class MockScoringService implements ScoringService {
  /** 暴露所用 rubric，便于测试断言与调试。 */
  public readonly rubric = RUBRIC_DIMENSIONS;

  async submitNote(input: SubmitNoteInput): Promise<SubmitNoteResult> {
    const initialScore = computeInitialScore(input.note, input.keyword);
    const count = followupCountFor(initialScore);
    return {
      initialScore,
      followups: buildFollowups(input.keyword.term, count),
    };
  }

  async finalize(input: FinalizeInput): Promise<FinalizeResult> {
    // 以原笔记重算初始分作为基准（不依赖外部传入分数，保证自洽且确定）。
    const initialScore = computeInitialScore(input.note, input.keyword);

    // 仅对实际产生过的追问计分；answers 按下标与 followups 对齐。
    const expected = input.followups.length;
    let adjustment = 0;
    let hasBlankAnswer = false;
    for (let i = 0; i < expected; i += 1) {
      const answer = input.answers[i] ?? "";
      if (textLength(answer) === 0) hasBlankAnswer = true;
      adjustment += answerAdjustment(answer);
    }

    const finalScore = clampScore(initialScore + adjustment);
    const passed = finalScore >= PASS_THRESHOLD;
    return {
      finalScore,
      passed,
      feedback: buildFeedback(finalScore, passed, hasBlankAnswer),
    };
  }

  async updateMemory(input: UpdateMemoryInput): Promise<UpdateMemoryResult> {
    const prev = input.learner.memory?.tags ?? EMPTY_TAGS;
    const tags: LearnerMemoryTags = {
      strengths: [...prev.strengths],
      weaknesses: [...prev.weaknesses],
      interests: [...prev.interests],
      blindSpots: [...prev.blindSpots],
    };
    const term = input.keyword.term;

    // 重提改分时先从三个「分数桶」移除，保证一个词只落在一个桶（重提通过会从盲区升到强项）
    removeFrom(tags.strengths, term);
    removeFrom(tags.weaknesses, term);
    removeFrom(tags.blindSpots, term);
    // 按最终分确定性分桶
    if (input.finalScore >= 80) pushUnique(tags.strengths, term);
    else if (input.finalScore < PASS_THRESHOLD) pushUnique(tags.blindSpots, term);
    else pushUnique(tags.weaknesses, term);
    // 笔记较长视为有钻研兴趣（确定性信号）
    if (textLength(input.note) >= 1500) pushUnique(tags.interests, term);

    capList(tags.strengths);
    capList(tags.weaknesses);
    capList(tags.interests);
    capList(tags.blindSpots);

    const portrait = buildPortrait(input.learner.profile, tags, term, input.finalScore);
    return { tags, portrait };
  }

  async reflectionQuestions(input: ReflectionQuestionsInput): Promise<string[]> {
    const pos = input.learner?.profile?.position ?? "你的岗位";
    const apply = input.learner?.profile?.applicationAreas?.trim();
    const qs = [
      `学完《${input.chapterTitle}》后，作为「${pos}」，本章哪个概念最可能用在你的日常工作中？打算怎么用？`,
      apply
        ? `这一章的知识，能帮你在「${apply}」上做出哪些具体改进？`
        : `这一章的知识，能帮你的实际工作做出哪些具体改进？`,
      `本章还有哪些没搞透、或想进一步深入的地方？`,
    ];
    return qs.slice(0, 3);
  }

  async reflectionSummary(input: ReflectionSummaryInput): Promise<ReflectionSummaryResult> {
    const pos = input.learner.profile?.position ?? "员工";
    const answered = input.answers.filter((a) => a.trim().length > 0).length;
    const summary =
      `已完成《${input.chapterTitle}》的章节反思（回答 ${answered}/${input.questions.length} 题）。` +
      `你开始把本章关键概念与「${pos}」岗位结合思考，建议挑一个点在实际工作中试着落地。`;
    const prevPortrait = input.learner.memory?.portrait ?? "";
    const portrait =
      `${prevPortrait}\n\n## 《${input.chapterTitle}》章节反思\n- ${summary}`.trim();
    return { summary, portrait };
  }
}

/** 把标签与最近进展渲染成固定结构的 Markdown 画像（确定性，便于按行 git-diff）。 */
function buildPortrait(
  profile: { position?: string; applicationAreas?: string } | undefined,
  tags: LearnerMemoryTags,
  term: string,
  finalScore: number,
): string {
  const band = finalScore >= 85 ? "优秀" : finalScore >= PASS_THRESHOLD ? "合格" : "待提升";
  const bullets = (arr: string[]): string =>
    arr.length ? arr.map((t) => `- ${t}`).join("\n") : "- （暂无）";
  const apply = profile?.applicationAreas?.trim();
  return [
    `# ${profile?.position ?? "员工"} · 学习画像`,
    "",
    "## 掌握强项",
    bullets(tags.strengths),
    "",
    "## 待加强",
    bullets(tags.weaknesses),
    "",
    "## 知识盲区",
    bullets(tags.blindSpots),
    "",
    "## 兴趣方向",
    bullets(tags.interests),
    "",
    "## 与岗位结合",
    apply ? `- 可尝试把所学用于：${apply}` : "- （待章节总结时结合岗位深入）",
    "",
    "## 最近进展",
    `- 完成「${term}」，得分 ${finalScore}（${band}）`,
  ].join("\n");
}

/** 去重追加（确定性）。 */
function pushUnique(list: string[], item: string): void {
  if (!list.includes(item)) list.push(item);
}

/** 从列表移除某项（确定性）。 */
function removeFrom(list: string[], item: string): void {
  const i = list.indexOf(item);
  if (i !== -1) list.splice(i, 1);
}

/** 限制列表长度，保留最近的若干项（确定性）。 */
function capList(list: string[], max = 20): void {
  if (list.length > max) list.splice(0, list.length - max);
}
