"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage } from "@/app/(app)/chat-actions";

export interface ChatMessage {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ChatProfileInfo {
  display_name: string;
  is_admin?: boolean;
}

interface Props {
  initialMessages: ChatMessage[];
  profiles: Record<string, ChatProfileInfo>;
  currentUserId: string | null;
  canPost: boolean;
}

const STORAGE_COLLAPSED = "chat_collapsed";
const STORAGE_LAST_SEEN = "chat_last_seen_id";
const MAX_LEN = 500;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function formatRelative(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 30) return "teď";
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} d`;
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}

function renderContent(text: string): React.ReactNode[] {
  // Auto-linkify http(s) URLs. Plain text otherwise; emoji rendered natively.
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_REGEX);
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sky-600 underline"
      >
        {match[0]}
      </a>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export function Chat({
  initialMessages,
  profiles,
  currentUserId,
  canPost,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [lastSeenId, setLastSeenId] = useState<number>(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Read localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_COLLAPSED) === "1");
    const raw = localStorage.getItem(STORAGE_LAST_SEEN);
    setLastSeenId(raw ? parseInt(raw, 10) || 0 : 0);
    setHydrated(true);
  }, []);

  // Realtime: subscribe to INSERTs on chat_messages.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("public:chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll on new message while expanded.
  useEffect(() => {
    if (!collapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  // When expanded, mark all current as read.
  useEffect(() => {
    if (!hydrated || collapsed) return;
    const maxId = messages.reduce((m, x) => (x.id > m ? x.id : m), 0);
    if (maxId > lastSeenId) {
      setLastSeenId(maxId);
      localStorage.setItem(STORAGE_LAST_SEEN, String(maxId));
    }
  }, [messages, collapsed, hydrated, lastSeenId]);

  const unread = hydrated
    ? messages.filter((m) => m.id > lastSeenId).length
    : 0;

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_COLLAPSED, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("content", text);
      const res = await sendChatMessage(fd);
      if (res?.ok) setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-3 rounded-md border bg-white">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
      >
        <span className="flex items-center gap-2">
          <span>Chat 💬</span>
          {collapsed && unread > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500">
          {collapsed ? "rozbalit ▾" : "sbalit ▴"}
        </span>
      </button>
      {!collapsed && (
        <div className="border-t">
          <div
            ref={listRef}
            className="h-[150px] overflow-y-auto px-3 py-2 text-sm"
          >
            {messages.length === 0 ? (
              <div className="py-6 text-center text-neutral-400">
                Žádné zprávy. Buď první!
              </div>
            ) : (
              messages.map((m) => {
                const p = profiles[m.user_id];
                const name = p?.display_name ?? "?";
                const nameCls = p?.is_admin
                  ? "text-amber-700"
                  : "text-neutral-700";
                return (
                  <div key={m.id} className="mb-1 flex flex-wrap items-baseline gap-x-1.5 leading-snug">
                    <span
                      className={`shrink-0 font-medium ${nameCls}`}
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {name}:
                    </span>
                    <span className="min-w-0 flex-1 break-words text-neutral-800">
                      {renderContent(m.content)}
                    </span>
                    <span
                      className="shrink-0 text-[10px] text-neutral-400"
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {formatRelative(m.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {canPost ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t bg-neutral-50 p-2"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Napiš zprávu... (URL a 😊 vítány)"
                maxLength={MAX_LEN}
                className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-300"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="shrink-0 rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white disabled:bg-neutral-300"
              >
                Odeslat
              </button>
            </form>
          ) : currentUserId ? (
            <div className="border-t bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Pro zápis do chatu musíš být schválený tipující.
            </div>
          ) : (
            <div className="border-t bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
              Pro zápis do chatu se přihlas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
