"use client";

import { SparklesIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** 「AI 思考过程」小弹窗：点分数旁的小按钮看 DeepSeek 评分时的完整推理。
 *  reasoning 为空（mock / 非流式 / 历史数据）则不渲染按钮。 */
export function ReasoningDialog({
  reasoning,
  title,
  summary,
  triggerLabel = "AI 思考过程",
}: {
  reasoning: string;
  title: string;
  summary: string;
  triggerLabel?: string;
}) {
  if (!reasoning.trim()) return null;
  return (
    <Dialog>
      <DialogTrigger className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50">
        <SparklesIcon className="size-3" aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3.5 text-sm leading-relaxed text-ink">
          {reasoning.trim()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
