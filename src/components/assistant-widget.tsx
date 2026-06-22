"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Check, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { consumeNdjson, StreamError, type NdjsonFrame } from "@/components/thinking";
import type {
  AssistantConfirmation,
  AssistantNavigationAction,
  AssistantPageContext,
} from "@/lib/assistant/types";

interface Message {
  role: "USER" | "ASSISTANT";
  content: string;
}

interface ToolLine {
  id: string;
  text: string;
  status: "running" | "success" | "error";
}

function pageContext(pathname: string): AssistantPageContext {
  const ctx: AssistantPageContext = { pathname };
  const keyword = pathname.match(/\/learn\/keyword\/([^/]+)/);
  if (keyword) ctx.keywordId = keyword[1];
  const subject = pathname.match(/\/learn\/([^/]+)(?:\/|$)/);
  if (subject && subject[1] !== "keyword") ctx.subjectId = subject[1];
  const chapter = pathname.match(/\/chapter\/(\d+)/);
  if (chapter) ctx.chapterIndex = Number(chapter[1]);
  return ctx;
}

function parseActions(frame: NdjsonFrame): AssistantNavigationAction[] {
  const raw = (frame as NdjsonFrame & { actions?: AssistantNavigationAction[] }).actions;
  return Array.isArray(raw) ? raw : [];
}

function parseConfirmation(frame: NdjsonFrame): AssistantConfirmation | null {
  const raw = (frame as NdjsonFrame & { confirmation?: AssistantConfirmation }).confirmation;
  return raw ?? null;
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState<ToolLine[]>([]);
  const [actions, setActions] = useState<AssistantNavigationAction[]>([]);
  const [confirmation, setConfirmation] = useState<AssistantConfirmation | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ctx = useMemo(() => pageContext(pathname), [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/assistant/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConversationId(data.conversationId ?? null);
        setMessages(
          (data.messages ?? [])
            .filter((m: { role: string }) => m.role === "USER" || m.role === "ASSISTANT")
            .map((m: { role: "USER" | "ASSISTANT"; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, tools, pending, open]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setError("");
    setActions([]);
    setConfirmation(null);
    setTools([]);
    setInput("");
    setPending(true);
    setMessages((prev) => [...prev, { role: "USER", content: text }, { role: "ASSISTANT", content: "" }]);

    let answer = "";
    try {
      await consumeNdjson(
        "/api/assistant/chat",
        { message: text, page: ctx, conversationId },
        (frame) => {
          if (frame.type === "answer") {
            answer += frame.text ?? "";
            setTools([]);
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = { role: "ASSISTANT", content: answer };
              return next;
            });
          } else if (frame.type === "status") {
            setTools([{ id: "status", text: frame.text ?? "", status: "running" }]);
          } else if (frame.type === "tool") {
            const f = frame as NdjsonFrame & { skill?: string; tool?: string; status?: ToolLine["status"] };
            const id = `${f.skill ?? "skill"}-${f.tool ?? "tool"}`;
            setTools((prev) => {
              const next = prev.filter((tool) => tool.id !== "status");
              const existing = next.findIndex((tool) => tool.id === id);
              const line = {
                id,
                text: frame.text ?? "",
                status: f.status ?? "success",
              };
              if (existing >= 0) next[existing] = line;
              else next.push(line);
              return next;
            });
          } else if (frame.type === "navigation") {
            setActions(parseActions(frame));
          } else if (frame.type === "confirmation") {
            setConfirmation(parseConfirmation(frame));
          } else if (frame.type === "done") {
            const f = frame as NdjsonFrame & { conversationId?: string };
            if (f.conversationId) setConversationId(f.conversationId);
            setTools([]);
          } else if (frame.type === "error") {
            throw new StreamError(frame.text || "助手出错了");
          }
        },
      );
    } catch (e) {
      setError(e instanceof StreamError ? e.message : "网络出错，请重试");
      setMessages((prev) => {
        const next = prev.slice();
        if (next.at(-1)?.role === "ASSISTANT" && !next.at(-1)?.content) next.pop();
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  async function confirmAction() {
    if (!confirmation || confirming) return;
    setConfirming(true);
    setError("");
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmation),
      });
      if (!res.ok) throw new StreamError(await res.text());
      setMessages((prev) => [
        ...prev,
        { role: "ASSISTANT", content: "兑换申请已提交，等待管理员审批。你可以在兑换页查看进度。" },
      ]);
      setConfirmation(null);
      setActions([{ label: "查看兑换页", href: "/redeem" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开智学助手"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-brand-600 text-white shadow-lg shadow-brand-200/60 transition hover:-translate-y-0.5 hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-200 print:hidden"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 print:hidden">
          <button
            type="button"
            aria-label="关闭助手遮罩"
            className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-0 right-0 flex h-[min(92vh,760px)] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:bottom-4 sm:right-4 sm:h-[720px] sm:w-[440px] sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-ink">智学助手</h2>
                  <p className="text-xs text-muted">学习教练 · 平台向导</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
                  你可以问我“我这周还差什么”“我的积分够兑换吗”，或“帮我申请兑换一本书 80 元”。
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "USER" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      m.role === "USER"
                        ? "max-w-[82%] rounded-2xl bg-brand-600 px-3 py-2 text-sm text-white"
                        : "max-w-[88%] rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink"
                    }
                  >
                    {m.role === "USER" ? (
                      <span className="whitespace-pre-wrap break-words text-white">{m.content}</span>
                    ) : m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      "正在整理…"
                    )}
                  </div>
                </div>
              ))}

              {tools.length > 0 && (
                <div className="space-y-1 rounded-lg border border-line bg-white/80 px-2.5 py-2">
                  {tools.map((tool) => (
                    <div key={tool.id} className="flex items-center gap-2 text-[11px] leading-5 text-muted">
                      {tool.status === "running" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                      ) : tool.status === "success" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span>{tool.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {confirmation?.kind === "requestRedemption" && (
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                  <div className="text-xs font-bold text-brand-700">兑换确认卡</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted">物品</span>
                    <span className="font-medium text-ink">{confirmation.item}</span>
                    <span className="text-muted">类别</span>
                    <span className="font-medium text-ink">{confirmation.category}</span>
                    <span className="text-muted">金额</span>
                    <span className="font-medium text-ink">{confirmation.amount} 积分</span>
                  </div>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    disabled={confirming}
                    onClick={confirmAction}
                  >
                    {confirming ? "提交中…" : "确认提交兑换申请"}
                  </Button>
                </div>
              )}

              {confirmation?.kind === "createReminderDraft" && (
                <div className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className="text-xs font-bold text-ink">提醒任务草案</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted">标题</span>
                    <span className="font-medium text-ink">{confirmation.title}</span>
                    <span className="text-muted">频率</span>
                    <span className="font-medium text-ink">{confirmation.cadence}</span>
                    <span className="text-muted">对象</span>
                    <span className="font-medium text-ink">{confirmation.target}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    当前版本只保留草案预览，后台自动调度会在后续版本接入。
                  </p>
                </div>
              )}

              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button key={`${action.href}-${action.label}`} asChild variant="outline" size="sm">
                      <Link href={action.href} onClick={() => setOpen(false)}>
                        {action.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={ask} className="border-t border-line p-3">
              {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={pending}
                  placeholder="用自然语言问问我…"
                  className="input min-w-0 flex-1"
                />
                <Button type="submit" size="icon" disabled={pending || !input.trim()}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
