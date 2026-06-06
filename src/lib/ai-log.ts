// ===========================================================================
// src/lib/ai-log.ts —— AI 调用审计（管理员可见每次调用的上下文与过程）。
// 用 AsyncLocalStorage 在编排层（learn / memory / reflection）注入调用归属（trace），
// 由打分服务底层（deepseek 的 chat()）读取并落一条 AiCallLog。
// 日志为 best-effort：写日志失败绝不影响打分主流程。
// ===========================================================================

import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

// 直接读 env，避免与 @/lib/scoring 形成 import 环（同 getScoringProvider 逻辑）。
function currentProvider(): string {
  return process.env.SCORING_PROVIDER === "deepseek" ? "deepseek" : "mock";
}

/** 一次 AI 调用的归属信息（由编排层提供）。 */
export interface AiTrace {
  phase: string;
  userId?: string;
  keywordId?: string;
  keywordTerm?: string;
  chapterId?: string;
  submissionId?: string;
}

const storage = new AsyncLocalStorage<AiTrace>();

/** 在带归属信息的上下文里执行 fn（其中的 AI 调用会被归到这次 trace）。 */
export function runWithAiTrace<T>(trace: AiTrace, fn: () => Promise<T>): Promise<T> {
  return storage.run(trace, fn);
}

function currentTrace(): AiTrace | undefined {
  return storage.getStore();
}

/** 打分服务底层产出的「一次调用记录」（与归属信息合并后落库）。 */
export interface AiCallRecord {
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  responseRaw?: string;
  reasoning?: string;
  parsed?: unknown;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  ok: boolean;
  errorText?: string;
}

/** 记录一次 AI 调用（归属取自当前 ALS trace）。捕获所有异常，绝不抛回业务流程。 */
export async function recordAiCall(record: AiCallRecord): Promise<void> {
  return writeLog(currentTrace(), record);
}

/** 记录一次 AI 调用，归属由调用方显式给出（流式路径用，不依赖 ALS）。 */
export async function recordAiCallWith(trace: AiTrace, record: AiCallRecord): Promise<void> {
  return writeLog(trace, record);
}

async function writeLog(trace: AiTrace | undefined, record: AiCallRecord): Promise<void> {
  try {
    await prisma.aiCallLog.create({
      data: {
        phase: trace?.phase ?? "unknown",
        provider: currentProvider(),
        model: record.model ?? null,
        userId: trace?.userId ?? null,
        keywordId: trace?.keywordId ?? null,
        keywordTerm: trace?.keywordTerm ?? null,
        chapterId: trace?.chapterId ?? null,
        submissionId: trace?.submissionId ?? null,
        systemPrompt: record.systemPrompt ?? null,
        userPrompt: record.userPrompt ?? null,
        responseRaw: record.responseRaw ?? null,
        reasoning: record.reasoning ?? null,
        parsed:
          record.parsed === undefined
            ? Prisma.JsonNull
            : (record.parsed as Prisma.InputJsonValue),
        promptTokens: record.promptTokens ?? null,
        completionTokens: record.completionTokens ?? null,
        reasoningTokens: record.reasoningTokens ?? null,
        totalTokens: record.totalTokens ?? null,
        latencyMs: record.latencyMs ?? null,
        ok: record.ok,
        errorText: record.errorText ?? null,
      },
    });
  } catch (e) {
    console.error("recordAiCall 写入失败（已忽略，不影响评分）：", e);
  }
}
