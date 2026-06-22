import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { answerDirectlyWithLlm, canUseAssistantLlm, planWithLlm, synthesizeWithLlm } from "./llm";
import { canUseTool } from "./permissions";
import { getAssistantSkills, selectAssistantSkills } from "./capabilities/registry";
import type {
  AssistantFrame,
  AssistantHistoryMessage,
  AssistantLearningContext,
  AssistantPageContext,
  AssistantPlannedToolCall,
  AssistantSkill,
  AssistantTool,
  AssistantToolContext,
  AssistantToolResult,
} from "./types";

const MAX_MESSAGE_LEN = 2000;

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function entityFrom(value: unknown) {
  if (!isRecord(value)) return undefined;
  return typeof value.id === "string" && typeof value.name === "string"
    ? { id: value.id, name: value.name }
    : undefined;
}

function learningContextFromMetadata(value: unknown): AssistantLearningContext {
  if (!isRecord(value)) return {};
  const raw = isRecord(value.assistantContext) ? value.assistantContext : value;
  return {
    learner: entityFrom(raw.learner),
    keyword: entityFrom(raw.keyword),
    subject: entityFrom(raw.subject),
  };
}

function mergeLearningContext(
  base: AssistantLearningContext,
  patch?: AssistantLearningContext,
): AssistantLearningContext {
  if (!patch) return base;
  return {
    learner: patch.learner ?? base.learner,
    keyword: patch.keyword ?? base.keyword,
    subject: patch.subject ?? base.subject,
  };
}

async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (existing) return existing;
  }
  const latest = await prisma.assistantConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (latest) return latest;
  return prisma.assistantConversation.create({ data: { userId } });
}

function defaultHelp(role: string): AssistantFrame[] {
  const admin = role !== "EMPLOYEE";
  return [
    {
      type: "answer",
      text:
        "我可以帮你查学习进度、积分余额、兑换规则，也能识别当前关键词复盘入口。你也可以说“帮我申请兑换一本书 80 元”，我会先生成确认卡，不会直接提交。",
    },
    {
      type: "navigation",
      actions: admin
        ? [
            { label: "开始闯关", href: "/learn" },
            { label: "积分兑换", href: "/redeem" },
            { label: "管理后台", href: "/admin" },
          ]
        : [
            { label: "开始闯关", href: "/learn" },
            { label: "积分兑换", href: "/redeem" },
          ],
    },
  ];
}

async function recordToolCall(
  runId: string,
  skillName: string,
  tool: AssistantTool,
  status: "SUCCESS" | "ERROR" | "SKIPPED",
  startedAt: number,
  input: unknown,
  result?: AssistantToolResult,
  errorText?: string,
) {
  await prisma.assistantToolCall.create({
    data: {
      runId,
      skillName,
      toolName: tool.name,
      status,
      inputSummary: toJson(tool.summarizeInput ? tool.summarizeInput(input) : { input }),
      resultSummary: toJson(
        result
          ? tool.summarizeResult
            ? tool.summarizeResult(result)
            : { summary: result.summary }
          : undefined,
      ),
      errorText: errorText ?? null,
      latencyMs: Date.now() - startedAt,
    },
  });
}

function callsFromFallback(skills: AssistantSkill[], message: string, page: AssistantPageContext, history: AssistantHistoryMessage[]): AssistantPlannedToolCall[] {
  return skills.flatMap((skill) =>
    skill.tools
      .filter((tool) => tool.match(message.toLowerCase(), page, history))
      .map((tool) => ({ skillName: skill.name, toolName: tool.name, reason: "fallback matcher" })),
  );
}

function findPlannedTool(call: AssistantPlannedToolCall) {
  const skill = getAssistantSkills().find((s) => s.name === call.skillName);
  const tool = skill?.tools.find((t) => t.name === call.toolName);
  return skill && tool ? { skill, tool } : null;
}

function toolSuccessText(tool: AssistantTool) {
  return `已完成：${tool.description.replace(/[。.]$/, "")}`;
}

export interface RunAssistantInput {
  user: { id: string; name: string; role: "EMPLOYEE" | "ADMIN" | "SUPERADMIN" };
  message: string;
  page?: AssistantPageContext;
  conversationId?: string;
}

export async function* runAssistant({
  user,
  message,
  page = {},
  conversationId,
}: RunAssistantInput): AsyncGenerator<AssistantFrame> {
  const text = message.trim();
  if (!text) {
    yield { type: "error", text: "先说点什么吧。" };
    return;
  }
  if (text.length > MAX_MESSAGE_LEN) {
    yield { type: "error", text: `一次最多 ${MAX_MESSAGE_LEN} 字。` };
    return;
  }

  const conversation = await getOrCreateConversation(user.id, conversationId);
  await prisma.assistantMessage.create({
    data: { conversationId: conversation.id, userId: user.id, role: "USER", content: text },
  });
  await prisma.assistantConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const recentMessages = await prisma.assistantMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { role: true, content: true, metadata: true },
  });
  const history: AssistantHistoryMessage[] = recentMessages
    .reverse()
    .map((m) => ({ role: m.role, content: m.content }));
  const assistantSkills = getAssistantSkills();
  let learningContext = recentMessages
    .map((m) => learningContextFromMetadata(m.metadata))
    .find((ctx) => ctx.learner || ctx.keyword || ctx.subject) ?? {};
  let plannedCalls: AssistantPlannedToolCall[] = [];
  let plannerMode: "llm" | "fallback" = "fallback";
  if (canUseAssistantLlm()) {
    try {
      yield { type: "status", text: "我正在基于上下文规划要调用的站内能力。" };
      plannedCalls = await planWithLlm({
        user,
        message: text,
        page,
        history,
        learningContext,
        skills: assistantSkills,
      });
      plannerMode = "llm";
    } catch (e) {
      console.error("assistant planner 失败，降级到本地 matcher：", e);
    }
  }
  if (plannedCalls.length === 0) {
    const selected = selectAssistantSkills(text, page, history);
    plannedCalls = callsFromFallback(selected, text, page, history);
  }
  const selectedSkillNames = [...new Set(plannedCalls.map((call) => call.skillName))];
  const run = await prisma.assistantRun.create({
    data: {
      conversationId: conversation.id,
      userId: user.id,
      userMessage: text,
      pageContext: toJson(page),
      selectedSkills: toJson(selectedSkillNames),
    },
  });

  let finalAnswer = "";
  try {
    if (plannedCalls.length === 0) {
      if (canUseAssistantLlm()) {
        try {
          for await (const delta of answerDirectlyWithLlm({
            user,
            message: text,
            page,
            history,
            learningContext,
            skills: assistantSkills,
          })) {
            finalAnswer += delta;
            yield { type: "answer", text: delta };
          }
        } catch (e) {
          console.error("assistant direct answer 失败，降级为帮助提示：", e);
        }
      }
      if (!finalAnswer) {
        for (const frame of defaultHelp(user.role)) {
          if (frame.type === "answer") finalAnswer += frame.text;
          yield frame;
        }
      }
    } else {
      const ctx: AssistantToolContext = { user, page, history, learningContext, runId: run.id };
      const toolResults: { skillName: string; toolName: string; result: AssistantToolResult }[] = [];
      for (const call of plannedCalls) {
        const resolved = findPlannedTool(call);
        if (!resolved) continue;
        const { skill, tool } = resolved;
        if (!canUseTool(user.role, tool.permission)) {
          const msg = "这个能力需要更高权限，我不能替你越权查看或操作。";
          await recordToolCall(run.id, skill.name, tool, "SKIPPED", Date.now(), text, undefined, msg);
          yield { type: "tool", skill: skill.name, tool: tool.name, status: "error", text: msg };
          continue;
        }
        const startedAt = Date.now();
        yield {
          type: "tool",
          skill: skill.name,
          tool: tool.name,
          status: "running",
          text: `${plannerMode === "llm" ? "Agent 选择" : "正在调用"}：${tool.description}`,
        };
        try {
          const toolInput = call.args ?? text;
          const result = await tool.execute(toolInput, ctx);
          learningContext = mergeLearningContext(learningContext, result.contextWrites);
          ctx.learningContext = learningContext;
          toolResults.push({ skillName: skill.name, toolName: tool.name, result });
          await recordToolCall(run.id, skill.name, tool, "SUCCESS", startedAt, toolInput, result);
          yield {
            type: "tool",
            skill: skill.name,
            tool: tool.name,
            status: "success",
            text: toolSuccessText(tool),
          };
          if (result.navigation?.length) yield { type: "navigation", actions: result.navigation };
          if (result.confirmation) yield { type: "confirmation", confirmation: result.confirmation };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "工具调用失败";
          await recordToolCall(run.id, skill.name, tool, "ERROR", startedAt, text, undefined, msg);
          yield { type: "tool", skill: skill.name, tool: tool.name, status: "error", text: msg };
          finalAnswer += (finalAnswer ? "\n\n" : "") + `这个能力暂时没跑通：${msg}`;
        }
      }
      if (toolResults.length > 0 && canUseAssistantLlm()) {
        try {
          for await (const delta of synthesizeWithLlm({
            user,
            message: text,
            page,
            history,
            learningContext,
            toolResults,
          })) {
            finalAnswer += delta;
            yield { type: "answer", text: delta };
          }
        } catch (e) {
          console.error("assistant synthesizer 失败，降级为工具摘要：", e);
        }
      }
      if (!finalAnswer && toolResults.length > 0) {
        finalAnswer = toolResults.map((r) => r.result.summary).join("\n\n");
        yield { type: "answer", text: finalAnswer };
      }
    }

    if (!finalAnswer) {
      finalAnswer = "我现在还不能处理这个请求，可以换个说法试试。";
      yield { type: "answer", text: finalAnswer };
    }
    await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        role: "ASSISTANT",
        content: finalAnswer,
        metadata: toJson({ assistantContext: learningContext }),
      },
    });
    await prisma.assistantRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", summary: finalAnswer.slice(0, 1000), completedAt: new Date() },
    });
    await prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    yield { type: "done", conversationId: conversation.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "助手出错了";
    await prisma.assistantRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorText: msg, completedAt: new Date() },
    });
    yield { type: "error", text: msg };
  }
}

export async function getRecentAssistantMessages(userId: string) {
  const conversation = await prisma.assistantConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { role: true, content: true, metadata: true, createdAt: true },
      },
    },
  });
  if (!conversation) return { conversationId: null, messages: [] };
  return {
    conversationId: conversation.id,
    messages: conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
