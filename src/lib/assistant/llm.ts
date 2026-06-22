import { recordAiCallWith } from "@/lib/ai-log";
import { getScoringProvider } from "@/lib/scoring";
import type {
  AssistantHistoryMessage,
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
    .slice(-8)
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

export async function planWithLlm(input: {
  user: { id: string; name: string; role: string };
  message: string;
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  skills: AssistantSkill[];
}): Promise<AssistantPlannedToolCall[]> {
  const cfg = readConfig();
  const system = `你是智学闯关平台的 Agent Planner。你必须根据用户当前问题、历史对话、页面上下文和可用 Skill，选择要调用的工具。
只输出严格 JSON，不要解释。
规则：
1. 可以选择 0-3 个工具。
2. 必须理解上下文追问，例如“分别是哪些人”要结合上一轮关于员工/管理员数量的问题。
3. 不要选择用户权限之外的工具；最终权限还有代码兜底。
4. 写操作只允许生成确认草案，不直接执行。
5. 如果选择工具，必须按工具 parameters 提取 args；无法确定的字段不要编造。
输出格式：{"calls":[{"skillName":"...","toolName":"...","reason":"...","args":{}}]}。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
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
      .slice(0, 3)
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
  toolResults: { skillName: string; toolName: string; result: AssistantToolResult }[];
}): AsyncGenerator<string> {
  const cfg = readConfig();
  const system = `你是“智学助手”，一个学习教练 + 平台向导。请基于工具结果回答用户当前问题。
要求：
1. 中文、简洁、直接回答问题。
2. 不编造工具结果没有的数据。
3. 如果工具结果包含确认卡/导航，正文只解释下一步，不要说已经执行写操作。
4. 尊重权限边界。`;
  const userPrompt = JSON.stringify(
    {
      user: input.user,
      page: input.page,
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
