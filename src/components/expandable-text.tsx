"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

// 折叠高度（约 3 行）。markdown 含块级元素，无法用 line-clamp，故统一用 max-height 量。
const COLLAPSED_MAX = 76;

/** 长文默认全部展开；超过约 3 行才出现「收起 / 展开全文」开关（按钮右下角）。
 *  markdown=true 时按 Markdown 渲染并用 max-height 折叠；否则按纯文本 line-clamp 折叠。 */
export function ExpandableText({
  text,
  className,
  markdown = false,
}: {
  text: string;
  className?: string;
  markdown?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true); // 默认展开
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    // 默认展开态下元素即自然全高，scrollHeight 即完整高度，超过折叠阈值才需要开关。
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > COLLAPSED_MAX + 2);
  }, [text]);

  const collapsed = !expanded;

  return (
    <div>
      <div
        ref={ref}
        className={cn(
          "text-sm leading-relaxed",
          !markdown && collapsed && "line-clamp-3 whitespace-pre-wrap",
          className,
        )}
        style={markdown && collapsed ? { maxHeight: COLLAPSED_MAX, overflow: "hidden" } : undefined}
      >
        {markdown ? <Markdown className={className}>{text}</Markdown> : text}
      </div>
      {(overflowing || expanded) && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer text-xs font-medium text-brand-700 transition hover:text-brand-600"
          >
            {expanded ? "收起" : "展开全文"}
          </button>
        </div>
      )}
    </div>
  );
}
