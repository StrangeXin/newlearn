"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

const COLLAPSED_MAX = 28;

/** 长文默认全部展开；超过约 3 行才出现「收起 / 展开全文」开关（按钮右下角）。
 *  markdown=true 时按 Markdown 渲染；折叠态统一只露 1 行。 */
export function ExpandableText({
  text,
  className,
  markdown = false,
  controls = true,
}: {
  text: string;
  className?: string;
  markdown?: boolean;
  controls?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true); // 默认展开
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    // 默认展开态下元素即自然全高，scrollHeight 即完整高度，超过折叠阈值才需要开关。
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > COLLAPSED_MAX + 2);
  }, [text]);

  const collapsed = controls && !expanded;

  return (
    <div>
      <div
        ref={ref}
        className={cn(
          "text-sm leading-relaxed",
          collapsed && "line-clamp-1",
          !markdown && "whitespace-pre-wrap",
          className,
        )}
      >
        {markdown ? <Markdown className={className}>{text}</Markdown> : text}
      </div>
      {controls && (overflowing || expanded) && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium leading-none text-brand-700 transition hover:text-brand-600"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
            {expanded ? "收起全文" : "展开全文"}
          </button>
        </div>
      )}
    </div>
  );
}
