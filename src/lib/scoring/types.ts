// ===========================================================================
// src/lib/scoring/types.ts
// 打分服务的契约与类型定义（对应 PRD §6 两段式学习闭环、§6.1 评分 rubric、
// §13 数据模型中的 Scoring.followups[] / Scoring.answers[]）。
//
// 设计说明：
// - 该模块只描述「契约」，不含任何实现细节。业务代码仅依赖此处的类型与接口，
//   不感知具体走的是 DeepSeekScoringService（生产）还是 MockScoringService（测试/演示），
//   由 SCORING_PROVIDER 环境变量切换（见 CLAUDE.md / PRD §2）。
// - 所有分数均为 1–100 的整数；及格线为 finalScore >= 60（见 PRD §6 步骤 7）。
// ===========================================================================

/** 关键词（与 §13 数据模型 Keyword 对齐，仅取打分所需字段）。 */
export interface Keyword {
  /** 关键词本身，例如「Transformer」。 */
  term: string;
  /** 可选简介，给学习者看的上下文。 */
  description?: string;
  /**
   * 可选「参考考核要点」。若提供，作为打分的额外上下文，
   * 用于提升打分准确度（见 PRD §5.1 / §6.1）；不填则由打分器自由判断。
   */
  referencePoints?: string[];
  /**
   * 可选「所在章节主题」（从起源到前沿的编排脉络）。作为追问/打分的背景上下文，
   * 帮助模型把该词放进章节脉络里找薄弱点；不写元指令，仅作上下文（见 PRD §14.3.1）。
   */
  chapterTheme?: string;
}

/** 单条评分维度（rubric）。所有维度的 weight 之和应为 1。 */
export interface RubricDimension {
  /** 维度名，例如「准确性」。 */
  name: string;
  /** 权重，0–1，且全部维度之和 = 1。 */
  weight: number;
  /** 该维度的中文释义，会注入到 DeepSeek 的 system prompt 中。 */
  description: string;
}

// ------------------------- 学习者上下文（个性化） -------------------------

/** 员工自填的基本资料（onboarding）。 */
export interface LearnerProfile {
  position: string; // 岗位
  department: string; // 部门
  level: string; // 职级 / 年限
  background: string; // 专业背景
  aiFamiliarity: string; // 对 AI 的熟悉度
  applicationAreas: string; // 想把 AI 用在哪些工作
}

/** 系统维护的结构化标签。 */
export interface LearnerMemoryTags {
  strengths: string[]; // 掌握强项
  weaknesses: string[]; // 薄弱点
  interests: string[]; // 兴趣方向
  blindSpots: string[]; // 知识盲区
}

/** 系统对该员工不断更新的画像与标签。 */
export interface LearnerMemory {
  tags: LearnerMemoryTags;
  portrait: string; // 自由文本画像摘要
}

/**
 * 学习者上下文：资料 + 记忆。注入到追问/评分提示，使追问越来越贴合岗位。
 * 两者都可缺省（资料未填、记忆尚空时退化为通用追问）。
 */
export interface LearnerContext {
  profile?: LearnerProfile;
  memory?: LearnerMemory;
}

// --------------------------- submitNote（第一段） ---------------------------

/** submitNote 的输入：原始笔记 + 关键词上下文（可选学习者上下文）。 */
export interface SubmitNoteInput {
  /** 学习者提交的纯文本笔记（业务层已校验 100–2000 字，见 PRD §6 步骤 2）。 */
  note: string;
  /** 当前关键词及其可选参考要点。 */
  keyword: Keyword;
  /** 可选学习者上下文：拼入提示让追问贴合其岗位与画像。 */
  learner?: LearnerContext;
}

/** submitNote 的输出：初始分 + 动态追问。 */
export interface SubmitNoteResult {
  /** 初始分，1–100 的整数。 */
  initialScore: number;
  /**
   * 根据笔记薄弱点动态生成的追问，数量为 1–3 个；
   * 笔记越完整、问得越少（见 PRD §6 步骤 4）。
   */
  followups: string[];
}

// ---------------------------- finalize（第二段） ----------------------------

/** finalize 的输入：原笔记 + 关键词 + 追问及其回答（可选学习者上下文）。 */
export interface FinalizeInput {
  /** 与第一段相同的原始笔记。 */
  note: string;
  /** 与第一段相同的关键词上下文。 */
  keyword: Keyword;
  /** 第一段产生的追问（保持顺序）。 */
  followups: string[];
  /**
   * 学习者对追问的逐条回答，与 followups 按下标一一对应；
   * 若某条未作答，约定传入空字符串占位以保持对齐。
   */
  answers: string[];
  /** 可选学习者上下文。 */
  learner?: LearnerContext;
}

/** finalize 的输出：最终分 + 是否及格 + 中文反馈。 */
export interface FinalizeResult {
  /** 最终分，1–100 的整数，在初始分基础上结合追问回答微调而来。 */
  finalScore: number;
  /** 是否及格：finalScore >= 60（见 PRD §6 步骤 7）。 */
  passed: boolean;
  /** 面向学习者的中文反馈（鼓励 + 可改进点）。 */
  feedback: string;
}

// --------------------------- updateMemory（画像增量更新） ---------------------------

/** updateMemory 的输入：本次关键词的完整表现 + 当前画像。 */
export interface UpdateMemoryInput {
  keyword: Keyword;
  note: string;
  followups: string[];
  answers: string[];
  finalScore: number;
  /** 当前学习者上下文（含已有记忆，作为增量更新的基础）。 */
  learner: LearnerContext;
}

/** updateMemory 的输出：更新后的标签与画像摘要。 */
export interface UpdateMemoryResult {
  tags: LearnerMemoryTags;
  portrait: string;
}

// --------------------------- 章节反思（结合岗位） ---------------------------

/** 生成章节反思问题的输入。 */
export interface ReflectionQuestionsInput {
  chapterTitle: string;
  chapterTheme: string;
  terms: string[];
  learner?: LearnerContext;
}

/** 章节反思总结的输入。 */
export interface ReflectionSummaryInput {
  chapterTitle: string;
  chapterTheme: string;
  questions: string[];
  answers: string[];
  learner: LearnerContext;
}

/** 章节反思总结输出：总结 + 更新后的画像（已融入岗位结合）。 */
export interface ReflectionSummaryResult {
  summary: string;
  portrait: string;
}

// --------------------------- 结果页追加提问 ---------------------------

/** 员工通关某词后在结果页向 AI 追加提问的输入。 */
export interface AnswerQuestionInput {
  keyword: Keyword;
  /** 该次提交的原笔记。 */
  note: string;
  /** 本次评分的追问与员工回答。 */
  followups: string[];
  answers: string[];
  /** 本轮新问题。 */
  question: string;
  /** 此前在本次提交里的提问与回答（多轮上下文）。 */
  priorQA?: { question: string; answer: string }[];
  learner?: LearnerContext;
}

/** 流式回答的一段增量：思考过程（reasoning）或正文（answer）。 */
export interface AnswerChunk {
  type: "reasoning" | "answer";
  text: string;
}

/**
 * 流式选项：传入 onReasoning 时，DeepSeek 实现走流式并把「思考过程」逐段回调出去；
 * Mock 无 reasoning，忽略此项、直接返回确定性结果。打不打分由实现决定，调用方无需感知。
 */
export interface ScoringStreamOpts {
  onReasoning?: (text: string) => void;
}

// -------------------------------- 服务接口 ---------------------------------

/**
 * 打分服务统一抽象。生产实现为 DeepSeekScoringService，
 * 测试与本地演示实现为 MockScoringService，通过 SCORING_PROVIDER 切换。
 */
export interface ScoringService {
  /** 第一段：对笔记打初始分并生成 1–3 个追问（结合学习者上下文个性化）。
   *  传入 opts.onReasoning 时（仅 DeepSeek 生效）流式展示思考过程，返回结果不变。 */
  submitNote(input: SubmitNoteInput, opts?: ScoringStreamOpts): Promise<SubmitNoteResult>;

  /** 第二段：综合原笔记与追问回答给出最终分、是否及格与中文反馈。 */
  finalize(input: FinalizeInput, opts?: ScoringStreamOpts): Promise<FinalizeResult>;

  /** 每个关键词终评后：依据本次表现增量更新该员工的标签与画像。 */
  updateMemory(input: UpdateMemoryInput): Promise<UpdateMemoryResult>;

  /** 章节学完后：生成 2-3 个「结合岗位」的反思问题。 */
  reflectionQuestions(input: ReflectionQuestionsInput): Promise<string[]>;

  /** 章节反思作答后：给出章节总结，并把岗位结合融入画像。 */
  reflectionSummary(
    input: ReflectionSummaryInput,
    opts?: ScoringStreamOpts,
  ): Promise<ReflectionSummaryResult>;

  /** 结果页追加提问：结合该词笔记/追问/历史提问，回答员工的新问题（非流式，Mock 确定性）。 */
  answerQuestion(input: AnswerQuestionInput): Promise<{ answer: string }>;

  /** 结果页追加提问的流式版：逐段产出思考过程/正文。
   *  DeepSeek 走真流式；Mock 把 answerQuestion 的完整回答确定性切片模拟。 */
  answerStream(input: AnswerQuestionInput): AsyncIterable<AnswerChunk>;
}

/** 空记忆标签（画像尚未建立时的初值）。 */
export const EMPTY_TAGS: LearnerMemoryTags = {
  strengths: [],
  weaknesses: [],
  interests: [],
  blindSpots: [],
};

/**
 * 通用评分维度，权重之和 = 1（见 PRD §6.1）。
 * DeepSeek 实现会把它注入 prompt；Mock 实现可用它做加权启发式。
 */
export const RUBRIC_DIMENSIONS: readonly RubricDimension[] = [
  {
    name: "准确性",
    weight: 0.3,
    description:
      "对关键词概念、定义与事实的表述是否正确无硬伤，有无张冠李戴或过时信息。",
  },
  {
    name: "深度",
    weight: 0.25,
    description:
      "是否超越表面定义，触及原理、机制、权衡取舍或与其它概念的关联。",
  },
  {
    name: "完整性",
    weight: 0.2,
    description:
      "是否覆盖该关键词的核心要点（若提供参考考核要点，则以其为基准衡量覆盖度）。",
  },
  {
    name: "条理性",
    weight: 0.15,
    description: "结构是否清晰、层次分明、表达连贯，便于阅读与理解。",
  },
  {
    name: "原创思考",
    weight: 0.1,
    description:
      "是否包含个人理解、举例、类比或批判性见解，而非纯粹复制资料。",
  },
];

/** 及格分数线（见 PRD §6 步骤 7）。 */
export const PASS_THRESHOLD = 60;
