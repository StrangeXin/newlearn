"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Check,
  History,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
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

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
}

const headerIconButtonClass =
  "text-muted hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:border-brand-300 focus-visible:ring-brand-200/70 aria-expanded:border-brand-200 aria-expanded:bg-brand-50 aria-expanded:text-brand-700";

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

function mapMessages(data: { messages?: { role: "USER" | "ASSISTANT"; content: string }[] }) {
  return (data.messages ?? [])
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({ role: m.role, content: m.content }));
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [switchingConversation, setSwitchingConversation] = useState(false);
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

  function clearTransientState() {
    setTools([]);
    setActions([]);
    setConfirmation(null);
    setError("");
  }

  async function loadConversations() {
    setLoadingConversations(true);
    try {
      const res = await fetch("/api/assistant/conversations");
      if (!res.ok) throw new StreamError(await res.text());
      const data = await res.json();
      const rows = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(rows);
    } catch {
      setError("历史对话加载失败");
    } finally {
      setLoadingConversations(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/assistant/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConversationId(data.conversationId ?? null);
        setMessages(mapMessages(data));
      })
      .catch(() => undefined);
    fetch("/api/assistant/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setConversations(Array.isArray(data.conversations) ? data.conversations : []);
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
            loadConversations().catch(() => undefined);
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

  async function createConversation(reset = false) {
    if (pending || switchingConversation) return;
    setSwitchingConversation(true);
    clearTransientState();
    try {
      const res = await fetch(reset ? "/api/assistant/conversations/reset" : "/api/assistant/conversations", {
        method: "POST",
      });
      if (!res.ok) throw new StreamError(await res.text());
      const data = await res.json();
      setConversationId(data.conversationId ?? null);
      setMessages([]);
      setInput("");
      setHistoryOpen(false);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建对话失败");
    } finally {
      setSwitchingConversation(false);
    }
  }

  async function switchConversation(id: string) {
    if (pending || switchingConversation || id === conversationId) return;
    setSwitchingConversation(true);
    clearTransientState();
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      if (!res.ok) throw new StreamError(await res.text());
      const data = await res.json();
      setConversationId(data.conversationId ?? id);
      setMessages(mapMessages(data));
      setInput("");
      setHistoryOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "切换对话失败");
    } finally {
      setSwitchingConversation(false);
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
          <section
            className={
              expanded
                ? "absolute inset-x-3 bottom-3 top-3 flex flex-col rounded-2xl border border-line bg-surface shadow-2xl sm:inset-x-8 sm:bottom-6 sm:right-6 sm:top-6 lg:left-auto lg:w-[min(920px,calc(100vw-3rem))]"
                : "absolute bottom-0 right-0 flex h-[min(92vh,760px)] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:bottom-4 sm:right-4 sm:h-[720px] sm:w-[440px] sm:rounded-2xl"
            }
          >
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
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerIconButtonClass}
                  disabled={pending || switchingConversation}
                  title="查看历史对话"
                  aria-label="查看历史对话"
                  aria-expanded={historyOpen}
                  onClick={() => {
                    setHistoryOpen((value) => !value);
                    loadConversations().catch(() => undefined);
                  }}
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerIconButtonClass}
                  disabled={pending || switchingConversation}
                  title="新建对话"
                  aria-label="新建对话"
                  onClick={() => createConversation(false)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerIconButtonClass}
                  disabled={pending || switchingConversation || messages.length === 0}
                  title="清空当前上下文"
                  aria-label="清空当前上下文"
                  onClick={() => createConversation(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerIconButtonClass}
                  title={expanded ? "还原窗口" : "放大窗口"}
                  aria-label={expanded ? "还原窗口" : "放大窗口"}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={headerIconButtonClass}
                  title="关闭助手"
                  aria-label="关闭助手"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {historyOpen && (
              <div className="border-b border-line bg-surface-2 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-ink">历史对话</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={pending || switchingConversation}
                    onClick={() => createConversation(false)}
                  >
                    <Plus className="h-3 w-3" />
                    新对话
                  </Button>
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {loadingConversations && (
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-muted">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      正在加载历史对话
                    </div>
                  )}
                  {!loadingConversations && conversations.length === 0 && (
                    <div className="rounded-lg border border-line bg-surface px-2 py-2 text-xs text-muted">
                      还没有历史对话。
                    </div>
                  )}
                  {!loadingConversations &&
                    conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        disabled={pending || switchingConversation}
                        onClick={() => switchConversation(conversation.id)}
                        className={
                          conversation.id === conversationId
                            ? "w-full rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-2 text-left"
                            : "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/60"
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-semibold text-ink">
                            {conversation.title || "新对话"}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted">
                            {formatConversationTime(conversation.updatedAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                          {conversation.preview || `${conversation.messageCount} 条消息`}
                        </div>
                      </button>
                    ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  清空上下文会开启新对话，学习数据、积分和历史日志不会被删除。
                </p>
              </div>
            )}

            <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
                  你可以问我“我这周还差什么”“我的积分够兑换吗”，或“帮我申请兑换一本书 80 元”。
                  {conversationId ? " 这是一个新的对话上下文。" : ""}
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
