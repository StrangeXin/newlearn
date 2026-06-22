import type { Role } from "@/generated/prisma/client";

export type AssistantPermission = "USER" | "ADMIN" | "SUPERADMIN";

export interface AssistantPageContext {
  pathname?: string;
  subjectId?: string;
  chapterIndex?: number;
  keywordId?: string;
  submissionId?: string;
}

export interface AssistantHistoryMessage {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}

export interface AssistantEntityRef {
  id: string;
  name: string;
}

export interface AssistantLearningContext {
  learner?: AssistantEntityRef;
  keyword?: AssistantEntityRef;
  subject?: AssistantEntityRef;
}

export interface AssistantNavigationAction {
  label: string;
  href: string;
}

export interface RedemptionDraft {
  kind: "requestRedemption";
  item: string;
  category: "BOOK" | "TOOL" | "COURSE" | "OTHER";
  amount: number;
}

export interface ReminderDraft {
  kind: "createReminderDraft";
  title: string;
  cadence: string;
  target: string;
}

export type AssistantConfirmation = RedemptionDraft | ReminderDraft;

export type AssistantFrame =
  | { type: "status"; text: string }
  | { type: "answer"; text: string }
  | { type: "tool"; skill: string; tool: string; status: "running" | "success" | "error"; text: string }
  | { type: "navigation"; actions: AssistantNavigationAction[] }
  | { type: "confirmation"; confirmation: AssistantConfirmation }
  | { type: "done"; conversationId: string }
  | { type: "error"; text: string };

export interface AssistantToolContext {
  user: {
    id: string;
    name: string;
    role: Role;
  };
  page: AssistantPageContext;
  history: AssistantHistoryMessage[];
  learningContext: AssistantLearningContext;
  runId: string;
}

export interface AssistantToolResult<T = unknown> {
  summary: string;
  data: T;
  contextWrites?: AssistantLearningContext;
  navigation?: AssistantNavigationAction[];
  confirmation?: AssistantConfirmation;
}

export interface AssistantTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  permission: AssistantPermission;
  parameters?: Record<string, unknown>;
  match: (
    message: string,
    page: AssistantPageContext,
    history: AssistantHistoryMessage[],
  ) => boolean;
  execute: (input: Input, ctx: AssistantToolContext) => Promise<AssistantToolResult<Output>>;
  summarizeInput?: (input: Input) => unknown;
  summarizeResult?: (result: AssistantToolResult<Output>) => unknown;
}

export interface AssistantSkill {
  name: string;
  description: string;
  permission: AssistantPermission;
  tools: AssistantTool[];
}

export interface AssistantPlannedToolCall {
  skillName: string;
  toolName: string;
  reason: string;
  args?: unknown;
}
