// ===========================================================================
// src/lib/scoring/index.ts
// 打分服务工厂：按 SCORING_PROVIDER 环境变量选择实现。
// 业务代码只 import { getScoringService } from "@/lib/scoring"。
// ===========================================================================

import { DeepSeekScoringService } from "./deepseek";
import { MockScoringService } from "./mock";
import type { ScoringService } from "./types";

export * from "./types";

export type ScoringProvider = "mock" | "deepseek";

export function getScoringProvider(): ScoringProvider {
  return process.env.SCORING_PROVIDER === "deepseek" ? "deepseek" : "mock";
}

let cached: ScoringService | undefined;

/** 返回单例打分服务（按当前 SCORING_PROVIDER）。 */
export function getScoringService(): ScoringService {
  if (!cached) {
    cached =
      getScoringProvider() === "deepseek"
        ? new DeepSeekScoringService()
        : new MockScoringService();
  }
  return cached;
}
