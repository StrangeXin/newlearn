// ===========================================================================
// src/lib/scoring/deepseek.ts
// DeepSeekScoringService —— 生产打分实现，调用 DeepSeek（OpenAI 兼容）Chat API。
// 两段式契约见 ./types.ts；评分 rubric 注入 system prompt，要求严格 JSON 返回。
// ===========================================================================

import {
  EMPTY_TAGS,
  FinalizeInput,
  FinalizeResult,
  LearnerContext,
  LearnerMemoryTags,
  PASS_THRESHOLD,
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
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
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
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek 返回为空，无法解析评分结果。");
  }
  return parseJsonObject(content);
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
  return `\n【学习者档案（用于让追问更贴合其岗位与水平；不要把这些信息当作笔记内容来打分）】\n${lines.join("\n")}\n`;
}

export class DeepSeekScoringService implements ScoringService {
  async submitNote(input: SubmitNoteInput): Promise<SubmitNoteResult> {
    const cfg = readConfig();
    const { note, keyword } = input;
    const userContent = `【任务阶段】submitNote
【关键词】
- 名称：${keyword.term}
- 简介：${keyword.description ?? "（无）"}
- 参考考核要点：
${formatReferencePoints(keyword.referencePoints)}
${formatLearner(input.learner)}
【学习者笔记】
${note}

请按 rubric 评估并据笔记薄弱点生成 1~3 个追问；若有学习者档案，让追问尽量贴合其岗位、背景与画像，引导其把该关键词与实际工作联系起来。输出严格 JSON：{"initialScore": 整数(1-100), "followups": [1~3 条中文追问]}（笔记越完整追问越少）。只返回 JSON。`;

    const obj = await chat(cfg, userContent);
    const initialScore = clampScore(Number(obj.initialScore));
    let followups = Array.isArray(obj.followups)
      ? obj.followups.map((f) => String(f)).filter((f) => f.trim().length > 0)
      : [];
    if (followups.length === 0) {
      followups = [`请进一步说明「${keyword.term}」的核心原理或机制，并举一个实例。`];
    }
    followups = followups.slice(0, 3);
    return { initialScore, followups };
  }

  async finalize(input: FinalizeInput): Promise<FinalizeResult> {
    const cfg = readConfig();
    const { note, keyword, followups, answers } = input;
    const qa = followups
      .map(
        (q, i) =>
          `追问${i + 1}：${q}\n回答${i + 1}：${answers[i]?.trim() ? answers[i] : "（未作答）"}`,
      )
      .join("\n");

    const userContent = `【任务阶段】finalize
【关键词】
- 名称：${keyword.term}
- 简介：${keyword.description ?? "（无）"}
- 参考考核要点：
${formatReferencePoints(keyword.referencePoints)}
${formatLearner(input.learner)}
【学习者笔记】
${note}

【追问与回答】
${qa}

综合原笔记与追问回答重新评估，输出严格 JSON：{"finalScore": 整数(1-100), "passed": 布尔(finalScore>=60), "feedback": "中文反馈"}。只返回 JSON。`;

    const obj = await chat(cfg, userContent);
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

【已有标签（在此基础上增量调整，不要凭空抹掉历史）】
${JSON.stringify(prev)}

请输出更新后的标签与一段不超过 200 字的中文画像摘要（这个员工是谁、当前掌握程度、薄弱处、如何把所学结合到其岗位）。严格 JSON：
{"tags":{"strengths":[],"weaknesses":[],"interests":[],"blindSpots":[]},"portrait":"..."}。只返回 JSON。`;

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
}

const MEMORY_SYSTEM_PROMPT = `你是 AI 学习平台的学情分析助手。你的任务是依据员工最新一次的学习表现，增量维护其「学习画像」——既要积累强项、兴趣，也要记录薄弱点与盲区，并思考如何把所学与其岗位结合。要求客观、具体、连续（在已有画像基础上演进），只输出严格 JSON。`;
