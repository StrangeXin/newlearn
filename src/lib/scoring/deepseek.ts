// ===========================================================================
// src/lib/scoring/deepseek.ts
// DeepSeekScoringService —— 生产打分实现，调用 DeepSeek（OpenAI 兼容）Chat API。
// 两段式契约见 ./types.ts；评分 rubric 注入 system prompt，要求严格 JSON 返回。
// ===========================================================================

import { recordAiCall, recordAiCallWith, type AiTrace } from "@/lib/ai-log";
import {
  AnswerChunk,
  AnswerQuestionInput,
  EMPTY_TAGS,
  FinalizeInput,
  FinalizeResult,
  LearnerContext,
  LearnerMemoryTags,
  PASS_THRESHOLD,
  ReflectionQuestionsInput,
  ReflectionSummaryInput,
  ReflectionSummaryResult,
  ScoringService,
  SubmitNoteInput,
  SubmitNoteResult,
  UpdateMemoryInput,
  UpdateMemoryResult,
} from "./types";

const SYSTEM_PROMPT = `你是 AI 学习平台的资深评审专家，负责对员工针对某个关键词提交的学习笔记进行严格、公正、可复现的打分与追问。

【评分量表 rubric（权重之和 = 1）】
1. 准确性（权重 0.30）：对关键词概念、定义与事实的表述是否正确无硬伤，有无张冠李戴或过时信息。
2. 深度（权重 0.25）：是否超越表面定义，触及原理、机制、权衡取舍或与其它概念的关联。
3. 完整性（权重 0.20）：是否覆盖该关键词的核心要点；若提供了「参考考核要点」，则以其为基准衡量覆盖度。
4. 条理性（权重 0.15）：结构是否清晰、层次分明、表达连贯，便于阅读与理解。
5. 原创思考（权重 0.10）：是否包含个人理解、举例、类比或批判性见解，而非纯粹复制资料。

【打分规则】
- 分数为 1–100 的整数；先按上述维度分别评估，再按权重加权得到总分，最后四舍五入为整数。
- 若提供了「参考考核要点」，将其作为额外上下文重点核对「完整性」与「准确性」；若未提供，则依据通用学科常识自由判断。
- 及格线为 60 分：finalScore >= 60 视为通过（passed = true），否则未通过。
- 评分须客观、可复现：对同一份内容应给出一致的判断，避免被篇幅堆砌或华丽辞藻误导。

【两段式流程】
- 第一段「submitNote」：阅读笔记，给出 initialScore，并依据笔记的薄弱点动态生成 1~3 个追问。笔记越完整、薄弱点越少，追问越少（最少 1 个，最多 3 个）。
- 第二段「finalize」：综合「原笔记 + 追问回答」重新评估，给出 finalScore、是否及格 passed，以及一段面向学习者的中文 feedback（先肯定亮点，再指出可改进处，语气鼓励、具体可执行）。

【输出格式（极其重要）】
- 只输出一个严格合法的 JSON 对象，不要输出任何解释、前后缀、Markdown 代码块或多余文字。
- 第一段只返回：{"initialScore": <1-100 整数>, "followups": [<1~3 条中文追问字符串>]}
- 第二段只返回：{"finalScore": <1-100 整数>, "passed": <true|false>, "feedback": "<中文反馈>"}
- 所有键名与结构必须与上面完全一致；分数必须是整数；passed 必须与 finalScore>=60 一致。`;

interface DeepSeekConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function readConfig(): DeepSeekConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY 未配置；请在 .env 中填写，或将 SCORING_PROVIDER 设为 mock。",
    );
  }
  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(
      /\/+$/,
      "",
    ),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  };
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** 从模型返回里稳健地抽取 JSON 对象（容忍偶发的代码块包裹）。 */
function parseJsonObject(content: string): Record<string, unknown> {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function formatReferencePoints(points?: string[]): string {
  if (!points || points.length === 0) return "（无，按通用常识判断）";
  return points.map((p, i) => `${i + 1}. ${p}`).join("\n");
}

async function chat(
  cfg: DeepSeekConfig,
  userContent: string,
  system: string = SYSTEM_PROMPT,
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  let content: string | undefined;
  let reasoning: string | undefined;
  let usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      }
    | undefined;
  let parsed: Record<string, unknown> | undefined;
  let errorText: string | undefined;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek 接口返回 ${res.status}：${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
      usage?: typeof usage;
    };
    content = data.choices?.[0]?.message?.content;
    reasoning = data.choices?.[0]?.message?.reasoning_content;
    usage = data.usage;
    if (!content) {
      throw new Error("DeepSeek 返回为空，无法解析评分结果。");
    }
    parsed = parseJsonObject(content);
    return parsed;
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    // 审计每次 AI 调用（含失败）；写日志不阻断、不影响主流程。
    await recordAiCall({
      model: cfg.model,
      systemPrompt: system,
      userPrompt: userContent,
      responseRaw: content,
      reasoning,
      parsed,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
      totalTokens: usage?.total_tokens,
      latencyMs: Date.now() - startedAt,
      ok: errorText === undefined,
      errorText,
    });
  }
}

/** 把学习者资料与画像拼成一段提示上下文（缺省则返回空串）。 */
function formatLearner(learner?: LearnerContext): string {
  if (!learner) return "";
  const lines: string[] = [];
  const p = learner.profile;
  if (p) {
    lines.push(
      `- 岗位：${p.position}；部门：${p.department}；职级/年限：${p.level}`,
      `- 专业背景：${p.background}`,
      `- 对 AI 的熟悉度：${p.aiFamiliarity}`,
      `- 最想把 AI 用在：${p.applicationAreas}`,
    );
  }
  const m = learner.memory;
  if (m) {
    const t = m.tags;
    if (t) {
      lines.push(
        `- 已知强项：${t.strengths.join("、") || "（暂无）"}`,
        `- 薄弱点：${t.weaknesses.join("、") || "（暂无）"}`,
        `- 兴趣方向：${t.interests.join("、") || "（暂无）"}`,
        `- 知识盲区：${t.blindSpots.join("、") || "（暂无）"}`,
      );
    }
    if (m.portrait?.trim()) lines.push(`- 画像摘要：${m.portrait}`);
  }
  if (lines.length === 0) return "";
  return `\n【学习者档案（仅供参考，勿当作笔记内容打分）】\n${lines.join("\n")}\n`;
}

function buildSubmitNotePrompt(input: SubmitNoteInput): string {
  const { note, keyword } = input;
  return `【任务阶段】submitNote
【关键词】
- 名称：${keyword.term}
- 简介：${keyword.description ?? "（无）"}
- 所在章节主题：${keyword.chapterTheme ?? "（无）"}
- 参考考核要点：
${formatReferencePoints(keyword.referencePoints)}
${formatLearner(input.learner)}
【学习者笔记】
${note}

请按 rubric 评估。追问要扣住这篇笔记本身：对照「参考考核要点」与「章节主题」，找出笔记里缺失、含糊或可深入之处，针对这些**具体短板**提 1~3 个追问，不要泛泛而问、也不要脱离笔记已写内容（笔记越完整、覆盖越全，追问越少）。输出严格 JSON：{"initialScore": 整数(1-100), "followups": [1~3 条中文追问]}。只返回 JSON。`;
}

function parseSubmitNote(obj: Record<string, unknown>, term: string): SubmitNoteResult {
  const initialScore = clampScore(Number(obj.initialScore));
  let followups = Array.isArray(obj.followups)
    ? obj.followups.map((f) => String(f)).filter((f) => f.trim().length > 0)
    : [];
  if (followups.length === 0) {
    followups = [`请进一步说明「${term}」的核心原理或机制，并举一个实例。`];
  }
  return { initialScore, followups: followups.slice(0, 3) };
}

function buildFinalizePrompt(input: FinalizeInput): string {
  const { note, keyword, followups, answers } = input;
  const qa = followups
    .map(
      (q, i) =>
        `追问${i + 1}：${q}\n回答${i + 1}：${answers[i]?.trim() ? answers[i] : "（未作答）"}`,
    )
    .join("\n");
  return `【任务阶段】finalize
【关键词】
- 名称：${keyword.term}
- 简介：${keyword.description ?? "（无）"}
- 所在章节主题：${keyword.chapterTheme ?? "（无）"}
- 参考考核要点：
${formatReferencePoints(keyword.referencePoints)}
${formatLearner(input.learner)}
【学习者笔记】
${note}

【追问与回答】
${qa}

综合原笔记与追问回答重新评估，输出严格 JSON：{"finalScore": 整数(1-100), "passed": 布尔(finalScore>=60), "feedback": "中文反馈"}。只返回 JSON。`;
}

function parseFinalize(obj: Record<string, unknown>): FinalizeResult {
  const finalScore = clampScore(Number(obj.finalScore));
  const passed = finalScore >= PASS_THRESHOLD; // 以分数为准，忽略模型可能的不一致
  const feedback =
    typeof obj.feedback === "string" && obj.feedback.trim().length > 0
      ? obj.feedback
      : passed
        ? `最终得分 ${finalScore} 分，已达到及格线。`
        : `最终得分 ${finalScore} 分，未达及格线，可重新提交再次挑战。`;
  return { finalScore, passed, feedback };
}

/** 流式跑一次「要 JSON 结果」的评分调用：把 reasoning 逐段交给 onReasoning 展示，
 *  content（JSON）只在后台累计、解析，不外泄给用户。结束/失败写一条审计日志。 */
async function streamChatJson(
  cfg: DeepSeekConfig,
  system: string,
  userContent: string,
  trace: AiTrace,
  onReasoning: (text: string) => void,
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  let content = "";
  let reasoning = "";
  let usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      }
    | undefined;
  let parsed: Record<string, unknown> | undefined;
  let errorText: string | undefined;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek 接口返回 ${res.status}：${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let json: {
          choices?: { delta?: { content?: string; reasoning_content?: string } }[];
          usage?: typeof usage;
        };
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          reasoning += delta.reasoning_content;
          onReasoning(delta.reasoning_content); // 思考过程：可展示
        }
        if (delta?.content) content += delta.content; // JSON：只累计，不外泄
        if (json.usage) usage = json.usage;
      }
    }
    if (!content.trim()) throw new Error("DeepSeek 流式返回为空");
    parsed = parseJsonObject(content);
    return parsed;
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(trace, {
      model: cfg.model,
      systemPrompt: system,
      userPrompt: userContent,
      responseRaw: content || undefined,
      reasoning: reasoning || undefined,
      parsed,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
      totalTokens: usage?.total_tokens,
      latencyMs: Date.now() - startedAt,
      ok: errorText === undefined,
      errorText,
    });
  }
}

/** 流式版 submitNote：展示思考过程，返回解析后的初分与追问。 */
export async function streamSubmitNoteDeepSeek(
  input: SubmitNoteInput,
  trace: AiTrace,
  onReasoning: (text: string) => void,
): Promise<SubmitNoteResult> {
  const obj = await streamChatJson(
    readConfig(),
    SYSTEM_PROMPT,
    buildSubmitNotePrompt(input),
    trace,
    onReasoning,
  );
  return parseSubmitNote(obj, input.keyword.term);
}

/** 流式版 finalize：展示思考过程，返回解析后的终评。 */
export async function streamFinalizeDeepSeek(
  input: FinalizeInput,
  trace: AiTrace,
  onReasoning: (text: string) => void,
): Promise<FinalizeResult> {
  const obj = await streamChatJson(
    readConfig(),
    SYSTEM_PROMPT,
    buildFinalizePrompt(input),
    trace,
    onReasoning,
  );
  return parseFinalize(obj);
}

function buildReflectionSummaryPrompt(input: ReflectionSummaryInput): string {
  const qa = input.questions
    .map(
      (q, i) =>
        `问${i + 1}：${q}\n答${i + 1}：${input.answers[i]?.trim() ? input.answers[i] : "（未作答）"}`,
    )
    .join("\n");
  return `根据员工对《${input.chapterTitle}》章节反思的回答，产出：
1) summary：一段面向该员工的中文章节总结（先肯定、再点出如何把本章用于其岗位、给一个可落地的小建议）。
2) portrait：在【已有画像】基础上更新的 Markdown 画像，重点补充/丰富「## 与岗位结合」小节，保持其它小节结构稳定，便于逐行对比。
${formatLearner(input.learner)}
【反思问答】
${qa}
【已有画像】
${input.learner.memory?.portrait || "（暂无）"}
严格 JSON：{"summary":"...","portrait":"<markdown>"}。只返回 JSON。`;
}

function parseReflectionSummary(
  obj: Record<string, unknown>,
  input: ReflectionSummaryInput,
): ReflectionSummaryResult {
  const summary = typeof obj.summary === "string" ? obj.summary : "已完成本章反思。";
  const portrait =
    typeof obj.portrait === "string" && obj.portrait.trim()
      ? obj.portrait
      : input.learner.memory?.portrait ?? "";
  return { summary, portrait };
}

/** 流式版章节反思总结：展示思考过程，返回解析后的总结与更新画像。 */
export async function streamReflectionSummaryDeepSeek(
  input: ReflectionSummaryInput,
  trace: AiTrace,
  onReasoning: (text: string) => void,
): Promise<ReflectionSummaryResult> {
  const obj = await streamChatJson(
    readConfig(),
    REFLECTION_SYSTEM_PROMPT,
    buildReflectionSummaryPrompt(input),
    trace,
    onReasoning,
  );
  return parseReflectionSummary(obj, input);
}

export class DeepSeekScoringService implements ScoringService {
  async submitNote(input: SubmitNoteInput): Promise<SubmitNoteResult> {
    const obj = await chat(readConfig(), buildSubmitNotePrompt(input));
    return parseSubmitNote(obj, input.keyword.term);
  }

  async finalize(input: FinalizeInput): Promise<FinalizeResult> {
    const obj = await chat(readConfig(), buildFinalizePrompt(input));
    return parseFinalize(obj);
  }

  async updateMemory(input: UpdateMemoryInput): Promise<UpdateMemoryResult> {
    const cfg = readConfig();
    const prev = input.learner.memory?.tags ?? EMPTY_TAGS;
    const qa = input.followups
      .map(
        (q, i) =>
          `追问${i + 1}：${q}\n回答${i + 1}：${input.answers[i]?.trim() ? input.answers[i] : "（未作答）"}`,
      )
      .join("\n");

    const userContent = `请基于该员工本次在关键词「${input.keyword.term}」上的表现，增量更新其学习画像。
${formatLearner(input.learner)}
【本次表现】
- 最终得分：${input.finalScore}
- 笔记：${input.note}
- 追问与回答：
${qa}

【已有标签】
${JSON.stringify(prev)}

【已有画像】
${input.learner.memory?.portrait || "（暂无，本次新建）"}

请输出更新后的标签，以及一份 Markdown 画像。画像必须**固定使用以下小节标题与顺序**（内容用「- 」无序列表，空则写「- （暂无）」），以便逐行 diff：
# {岗位} · 学习画像
## 掌握强项
## 待加强
## 知识盲区
## 兴趣方向
## 与岗位结合
## 最近进展
严格 JSON：{"tags":{"strengths":[],"weaknesses":[],"interests":[],"blindSpots":[]},"portrait":"<markdown 字符串>"}。只返回 JSON。`;

    const obj = await chat(cfg, userContent, MEMORY_SYSTEM_PROMPT);
    const rawTags = (obj.tags ?? {}) as Record<string, unknown>;
    const toStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim()) : [];
    const tags: LearnerMemoryTags = {
      strengths: toStrArr(rawTags.strengths),
      weaknesses: toStrArr(rawTags.weaknesses),
      interests: toStrArr(rawTags.interests),
      blindSpots: toStrArr(rawTags.blindSpots),
    };
    const portrait =
      typeof obj.portrait === "string" ? obj.portrait : input.learner.memory?.portrait ?? "";
    return { tags, portrait };
  }

  async reflectionQuestions(input: ReflectionQuestionsInput): Promise<string[]> {
    // 兜底题：模型偶发返回非法 JSON / 请求失败时，仍给出可用的结合岗位反思题，绝不让整页崩。
    const fallback = [
      `结合你的岗位，《${input.chapterTitle}》里最能用上的是哪一点？打算怎么用？`,
      `本章学完后，你工作中哪个环节可以用这些知识来改进？举一个具体例子。`,
    ];
    try {
      const cfg = readConfig();
      const userContent = `员工刚学完一个章节，请生成 2-3 个「结合该员工岗位与实际工作」的反思问题，帮助 ta 把本章知识落到工作中（而不是停留在概念）。
章节：《${input.chapterTitle}》——${input.chapterTheme}
本章关键词：${input.terms.join("、")}
${formatLearner(input.learner)}
问题要具体、贴合其岗位与应用场景，引导其思考「如何用」「能改进什么」。严格 JSON：{"questions": ["...", "..."]}。只返回 JSON。`;
      const obj = await chat(cfg, userContent, REFLECTION_SYSTEM_PROMPT);
      const qs = Array.isArray(obj.questions)
        ? obj.questions.map((q) => String(q)).filter((q) => q.trim()).slice(0, 3)
        : [];
      return qs.length ? qs : fallback;
    } catch (e) {
      // chat() 已把失败写进 AI 审计日志；这里只兜底，保证反思页可用。
      console.error("reflectionQuestions 生成失败，使用兜底问题：", e);
      return fallback;
    }
  }

  async reflectionSummary(input: ReflectionSummaryInput): Promise<ReflectionSummaryResult> {
    const obj = await chat(
      readConfig(),
      buildReflectionSummaryPrompt(input),
      REFLECTION_SYSTEM_PROMPT,
    );
    return parseReflectionSummary(obj, input);
  }

  async answerQuestion(input: AnswerQuestionInput): Promise<{ answer: string }> {
    const cfg = readConfig();
    const userContent = `${buildAnswerContext(input)}\n严格 JSON：{"answer":"<中文回答>"}。只返回 JSON。`;
    const obj = await chat(cfg, userContent, QUESTION_SYSTEM_PROMPT);
    const answer =
      typeof obj.answer === "string" && obj.answer.trim()
        ? obj.answer
        : "抱歉，这个问题我暂时答不上来，换个问法再试试。";
    return { answer };
  }
}

const QUESTION_SYSTEM_PROMPT = `你是 AI 学习平台的答疑助教。员工就刚学完的关键词向你追问，你要结合其笔记、追问回答与岗位背景，给出准确、具体、可落地的中文解答。诚实，不确定就说明。`;

/** 拼装追问提问的上下文（关键词 / 学习者档案 / 本次笔记 / 追问回答 / 历史提问 / 新问题），不含输出格式指令。 */
function buildAnswerContext(input: AnswerQuestionInput): string {
  const qa = input.followups
    .map(
      (q, i) =>
        `追问${i + 1}：${q}\n回答${i + 1}：${input.answers[i]?.trim() ? input.answers[i] : "（未作答）"}`,
    )
    .join("\n");
  const history = (input.priorQA ?? [])
    .map((h, i) => `历史问${i + 1}：${h.question}\n历史答${i + 1}：${h.answer}`)
    .join("\n");
  return `员工已通关关键词「${input.keyword.term}」，现在就这个词向你追加提问。请结合下面上下文，针对性回答 ta 的新问题。
【关键词】
- 名称：${input.keyword.term}
- 简介：${input.keyword.description ?? "（无）"}
- 所在章节主题：${input.keyword.chapterTheme ?? "（无）"}
${formatLearner(input.learner)}
【该员工本次的笔记】
${input.note}
【本次的追问与回答】
${qa || "（无）"}
${history ? `【此前的提问与回答】\n${history}\n` : ""}【员工的新问题】
${input.question}

作答要求：准确、具体、可落地，必要时结合 ta 的岗位与本次笔记里的薄弱点；篇幅适中，不堆砌；不知道就直说。`;
}

/** 流式回答追问（DeepSeek SSE）。逐段 yield 思考过程 / 正文；结束/失败时写一条 AI 审计日志（归属显式传入）。 */
export async function* streamAnswerDeepSeek(
  input: AnswerQuestionInput,
  trace: AiTrace,
): AsyncGenerator<AnswerChunk> {
  const cfg = readConfig();
  const system = QUESTION_SYSTEM_PROMPT;
  const userContent = `${buildAnswerContext(input)}\n请用中文直接输出正文，不要用 JSON 或代码块包裹。`;
  const startedAt = Date.now();
  let content = "";
  let reasoning = "";
  let usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      }
    | undefined;
  let errorText: string | undefined;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
        temperature: 0.3,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new Error(`DeepSeek 接口返回 ${res.status}：${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let json: {
          choices?: { delta?: { content?: string; reasoning_content?: string } }[];
          usage?: typeof usage;
        };
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          reasoning += delta.reasoning_content;
          yield { type: "reasoning", text: delta.reasoning_content };
        }
        if (delta?.content) {
          content += delta.content;
          yield { type: "answer", text: delta.content };
        }
        if (json.usage) usage = json.usage;
      }
    }
    if (!content.trim()) throw new Error("DeepSeek 流式返回为空");
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(trace, {
      model: cfg.model,
      systemPrompt: system,
      userPrompt: userContent,
      responseRaw: content || undefined,
      reasoning: reasoning || undefined,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
      totalTokens: usage?.total_tokens,
      latencyMs: Date.now() - startedAt,
      ok: errorText === undefined,
      errorText,
    });
  }
}

const REFLECTION_SYSTEM_PROMPT = `你是 AI 学习平台的学习教练，擅长把抽象知识与员工的真实岗位连接起来，帮助其学以致用。输出务必结合员工档案与岗位，具体、可落地，只输出严格 JSON。`;

const MEMORY_SYSTEM_PROMPT = `你是 AI 学习平台的学情分析助手。你的任务是依据员工最新一次的学习表现，增量维护其「学习画像」——既要积累强项、兴趣，也要记录薄弱点与盲区，并思考如何把所学与其岗位结合。要求客观、具体、连续（在已有画像基础上演进），只输出严格 JSON。`;
