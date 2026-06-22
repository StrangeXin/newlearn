import { recordAiCallWith } from "@/lib/ai-log";
import { getScoringProvider } from "@/lib/scoring";
import type {
  AssistantHistoryMessage,
  AssistantLearningContext,
  AssistantPageContext,
  AssistantPlannedToolCall,
  AssistantSkill,
  AssistantToolResult,
} from "./types";

interface AssistantLlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function readConfig(): AssistantLlmConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
  };
}

function parseJsonObject(content: string): Record<string, unknown> {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as Record<string, unknown>;
}

function formatHistory(history: AssistantHistoryMessage[]) {
  return history
    .map((m) => `${m.role === "USER" ? "用户" : m.role === "ASSISTANT" ? "助手" : "系统"}：${m.content}`)
    .join("\n");
}

function formatManifest(skills: AssistantSkill[]) {
  return skills
    .map((skill) => ({
      name: skill.name,
      description: skill.description,
      permission: skill.permission,
      tools: skill.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        permission: tool.permission,
        parameters: tool.parameters ?? { type: "object", properties: {} },
      })),
    }));
}

export function canUseAssistantLlm() {
  return getScoringProvider() === "deepseek" && Boolean(process.env.DEEPSEEK_API_KEY);
}

function entityFrom(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string"
    ? { id: record.id, name: record.name }
    : undefined;
}

export async function compactContextWithLlm(input: {
  user: { id: string; name: string; role: string };
  message: string;
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  knownContext: AssistantLearningContext;
}): Promise<AssistantLearningContext> {
  const cfg = readConfig();
  const system = `你是智学闯关平台 Agent 的 Context Compactor。你的任务是在历史消息过长时，基于截断后的最近历史窗口和已确认实体快照，提炼当前轮工具调用需要的结构化上下文。
只输出严格 JSON，不要解释。
规则：
1. 只保留历史中已经由工具确认过、或用户最近明确指定的实体。
2. 不要凭空发明 id；如果没有可靠 id，就不要输出该实体。
3. 如果用户最近切换了员工/关键词/学科，以最近明确对象为准。
4. 输出格式：{"learningContext":{"learner":{"id":"...","name":"..."},"keyword":{"id":"...","name":"..."},"subject":{"id":"...","name":"..."}}}。缺失字段省略。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
      currentMessage: input.message,
      knownContext: input.knownContext,
      history: input.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
    null,
    2,
  );
  const startedAt = Date.now();
  let raw: string | undefined;
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek context compactor 返回 ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("DeepSeek context compactor 返回为空");
    parsed = parseJsonObject(raw);
    const learningContext =
      parsed.learningContext && typeof parsed.learningContext === "object"
        ? (parsed.learningContext as Record<string, unknown>)
        : {};
    return {
      learner: entityFrom(learningContext.learner),
      keyword: entityFrom(learningContext.keyword),
      subject: entityFrom(learningContext.subject),
    };
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(
      { phase: "assistant.chat.compactContext", userId: input.user.id },
      {
        model: cfg.model,
        systemPrompt: system,
        userPrompt,
        responseRaw: raw,
        parsed,
        latencyMs: Date.now() - startedAt,
        ok: errorText === undefined,
        errorText,
      },
    );
  }
}

export async function planWithLlm(input: {
  user: { id: string; name: string; role: string };
  message: string;
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  learningContext: AssistantLearningContext;
  skills: AssistantSkill[];
}): Promise<AssistantPlannedToolCall[]> {
  const cfg = readConfig();
  const system = `你是智学闯关平台的 Agent Planner。你必须根据用户当前问题、历史对话、页面上下文和 Capability Registry 暴露的可用能力，选择要调用的工具。
只输出严格 JSON，不要解释。
规则：
1. 可以选择 0-6 个工具，允许多步组合：先 resolve 实体，再查数据；多关键词对比时可以分别 resolve 和查询。
2. 必须理解上下文追问，例如“分别是哪些人”要结合上一轮关于员工/管理员数量的问题；“这个关键词/他/她”要沿用历史里已解析的员工或关键词。
3. 不要选择用户权限之外的工具；最终权限还有代码兜底。
4. 写操作只允许生成确认草案，不直接执行。
5. 如果选择工具，必须按工具 parameters 提取 args；无法确定的字段不要编造。
6. 管理员学情问题优先用小工具组合，不要默认使用 getAdminLearnerDetail：
   - 提到员工姓名但没有 learnerId：先 resolveLearner。
   - 如果当前问题是“他/她/还有哪些/这个人”等追问，且历史消息能明确指向某个员工，但 learningContext 里没有 learner.id：必须先 resolveLearner，并把历史中的员工姓名作为 args.name。
   - 问“某员工的数据/学情/学习情况/画像/进度怎么样”时，必须在 resolveLearner 后继续调用 getLearnerOverview；不要只停在 resolveLearner。
   - 提到关键词名称但没有 keywordId：先 resolveKeyword 查询候选；如果工具返回 ambiguous，不要继续假定其中一个候选，让最终回复反问用户确认。
   - 问员工概览/画像/进度：getLearnerOverview。
   - 问员工完成了哪些题、每题分数、个人均分：listLearnerKeywordRecords。
   - 问某员工某关键词多少分：getLearnerKeywordRecord。
   - 问某关键词整体/全员平均分：getKeywordAnalytics。
   - 问一个或多个关键词“哪些人完成/完成名单”：优先用 getKeywordCompletionLearners。
   - 如果用户说“图灵机这个关键词的平均分”，且上下文里已有员工，通常同时调用 getLearnerKeywordRecord 和 getKeywordAnalytics，用于区分个人分数与全员均分。
7. 排行榜/上榜/通关人员/积分榜/章节排名问题，优先使用 leaderboard skill，不要用 admin-insights 的员工名单代替排行榜数据。
8. “我是谁/我的资料/我的画像/我的信息”这类当前用户自查问题，优先使用 self-profile skill，不要用 learning-progress 或 personal-account 拼凑，也不要说无法获取站内资料。
9. 对进度、分数、名单、排行榜、钱包、审批等实时数据问题，必须调用 capability/query API；历史回答只能用于理解对象，不可作为最新事实来源。
输出格式：{"calls":[{"skillName":"...","toolName":"...","reason":"...","args":{}}]}。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
      learningContext: input.learningContext,
      history: formatHistory(input.history),
      currentMessage: input.message,
      skills: formatManifest(input.skills),
    },
    null,
    2,
  );
  const startedAt = Date.now();
  let raw: string | undefined;
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek planner 返回 ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("DeepSeek planner 返回为空");
    parsed = parseJsonObject(raw);
    const calls = Array.isArray(parsed.calls) ? parsed.calls : [];
    return calls
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.skillName === "string" && typeof c.toolName === "string")
      .slice(0, 6)
      .map((c) => ({
        skillName: String(c.skillName),
        toolName: String(c.toolName),
        reason: typeof c.reason === "string" ? c.reason : "模型选择调用该工具",
        args: c.args,
      }));
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(
      { phase: "assistant.chat.plan", userId: input.user.id },
      {
        model: cfg.model,
        systemPrompt: system,
        userPrompt,
        responseRaw: raw,
        parsed,
        latencyMs: Date.now() - startedAt,
        ok: errorText === undefined,
        errorText,
      },
    );
  }
}

export async function* synthesizeWithLlm(input: {
  user: { id: string; name: string; role: string };
  message: string;
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  learningContext: AssistantLearningContext;
  toolResults: { skillName: string; toolName: string; result: AssistantToolResult }[];
}): AsyncGenerator<string> {
  const cfg = readConfig();
  const system = `你是“智学助手”，一个学习教练 + 平台向导。请基于工具结果回答用户当前问题。
要求：
1. 中文、简洁、直接回答问题。
2. 不编造工具结果没有的数据。
3. 如果工具结果包含确认卡/导航，正文只解释下一步，不要说已经执行写操作。
4. 尊重权限边界。
5. 当工具同时返回个人关键词得分和关键词全员统计时，必须明确区分“该员工个人分数”和“该关键词全员平均分”。
6. 如果工具结果 data.ambiguous=true，必须停止给结论，列出候选项并反问用户“你指的是哪一个”。
7. 只要某个工具结果 data.found=true，必须直接使用该工具 data 和 summary 回答；不要再说“需要先指定/确认”或忽略已经成功返回的数据。
8. 对 listLearnerKeywordRecords 的结果，必须列出 records 中的关键词、分数、学科；不要把 getKeywordCoachHint 这类辅助提示当成主结果。
9. 排行榜工具里的 completed 表示“已通过关键词数”；不要说成“完成全部学习/全学科通关”，除非工具明确返回全学科完成。
10. 对 getLeaderboardSnapshot 的结果，completedPeople 是全平台各学习榜去重上榜人员；activeSubject.rows 只是当前/默认学科榜。不要说所有 completedPeople 都属于 activeSubject。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
      learningContext: input.learningContext,
      history: formatHistory(input.history),
      currentMessage: input.message,
      toolResults: input.toolResults.map((r) => ({
        skillName: r.skillName,
        toolName: r.toolName,
        summary: r.result.summary,
        data: r.result.data,
        hasConfirmation: Boolean(r.result.confirmation),
        navigation: r.result.navigation,
      })),
    },
    null,
    2,
  );
  const startedAt = Date.now();
  let content = "";
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`DeepSeek synthesizer 返回 ${res.status}`);
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
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield delta;
          }
        } catch {
          continue;
        }
      }
    }
    if (!content.trim()) throw new Error("DeepSeek synthesizer 返回为空");
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(
      { phase: "assistant.chat.synthesize", userId: input.user.id },
      {
        model: cfg.model,
        systemPrompt: system,
        userPrompt,
        responseRaw: content || undefined,
        latencyMs: Date.now() - startedAt,
        ok: errorText === undefined,
        errorText,
      },
    );
  }
}

export async function* answerDirectlyWithLlm(input: {
  user: { id: string; name: string; role: string };
  message: string;
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  learningContext: AssistantLearningContext;
  skills: AssistantSkill[];
}): AsyncGenerator<string> {
  const cfg = readConfig();
  const system = `你是“智学助手”，一个学习教练 + 平台向导。
当前没有可直接调用的站内 Skill 工具，或用户只是进行普通询问。请直接回复用户。
要求：
1. 中文、简洁、直接。
2. 不要编造站内数据；需要查数据时说明需要对应权限或让用户换成更明确的对象。
3. 可以根据可用 Skill 简要提示下一步，但不要输出泛化菜单。
4. 不要声称已经执行了站内操作。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
      learningContext: input.learningContext,
      history: formatHistory(input.history),
      currentMessage: input.message,
      availableSkills: formatManifest(input.skills),
    },
    null,
    2,
  );
  const startedAt = Date.now();
  let content = "";
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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`DeepSeek direct answer 返回 ${res.status}`);
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
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            yield delta;
          }
        } catch {
          continue;
        }
      }
    }
    if (!content.trim()) throw new Error("DeepSeek direct answer 返回为空");
  } catch (e) {
    errorText = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiCallWith(
      { phase: "assistant.chat.direct", userId: input.user.id },
      {
        model: cfg.model,
        systemPrompt: system,
        userPrompt,
        responseRaw: content || undefined,
        latencyMs: Date.now() - startedAt,
        ok: errorText === undefined,
        errorText,
      },
    );
  }
}
