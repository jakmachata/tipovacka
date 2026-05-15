"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage } from "@/app/(app)/chat-actions";

// Emoji picker — heavy client-only widget, lazy load.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="rounded-md border bg-white px-2 py-1 text-xs text-neutral-500">
      Načítám emoji…
    </div>
  ),
});

export interface ChatMessage {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ChatProfileInfo {
  display_name: string;
  is_admin?: boolean;
  bg_color?: string | null;
  text_color?: string | null;
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

// Fallback name palette for users without bg_color/text_color set.
// Stable per user_id via simple hash.
// Mirrors tip-matrix HEADER_COLORS so chat usernames match the column color.
const FALLBACK_COLORS: Array<{ bg: string; fg: string }> = [
  { bg: "#e11d48", fg: "#ffffff" }, // rose-600
  { bg: "#ea580c", fg: "#ffffff" }, // orange-600
  { bg: "#d97706", fg: "#ffffff" }, // amber-600
  { bg: "#ca8a04", fg: "#ffffff" }, // yellow-600
  { bg: "#65a30d", fg: "#ffffff" }, // lime-600
  { bg: "#16a34a", fg: "#ffffff" }, // green-600
  { bg: "#059669", fg: "#ffffff" }, // emerald-600
  { bg: "#0d9488", fg: "#ffffff" }, // teal-600
  { bg: "#0891b2", fg: "#ffffff" }, // cyan-600
  { bg: "#0284c7", fg: "#ffffff" }, // sky-600
  { bg: "#2563eb", fg: "#ffffff" }, // blue-600
  { bg: "#4f46e5", fg: "#ffffff" }, // indigo-600
  { bg: "#7c3aed", fg: "#ffffff" }, // violet-600
  { bg: "#c026d3", fg: "#ffffff" }, // fuchsia-600
  { bg: "#db2777", fg: "#ffffff" }, // pink-600
];

function fallbackColor(id: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `vč ${time}`;
  return `${d.getDate()}.${d.getMonth() + 1}. ${time}`;
}

function renderContent(text: string): React.ReactNode[] {
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  // Read localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_COLLAPSED) === "1");
    const raw = localStorage.getItem(STORAGE_LAST_SEEN);
    setLastSeenId(raw ? parseInt(raw, 10) || 0 : 0);
    setHydrated(true);
  }, []);

  // Realtime: explicitly attach the user's JWT to the realtime client, then
  // subscribe to INSERTs on chat_messages. Without setAuth, RLS-protected
  // postgres_changes broadcasts may not reach other authenticated clients.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch {
        // Continue even if setAuth fails — guest will just miss broadcasts.
      }
      if (cancelled) return;
      channel = supabase
        .channel("chat-room")
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
    })();

    return () => {
      cancelled = true;
      if (channel) {
        const supabase2 = createClient();
        supabase2.removeChannel(channel);
      }
    };
  }, []);

  // Auto-scroll to bottom whenever messages change (and on initial mount).
  // useLayoutEffect runs before paint so the user never sees the top scroll
  // position briefly before jumping to the bottom.
  useLayoutEffect(() => {
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

  // Hide chat once user scrolls (wrapper on mobile, window on desktop) — chat is meant
  // for at-rest reading; scroll-to-table should not be obscured by chat.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let scrollTarget: HTMLElement | Window | null = window;
    let el: HTMLElement | null = rootRef.current;
    while (el && el !== document.body) {
      const cs = window.getComputedStyle(el);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
        scrollTarget = el;
        break;
      }
      el = el.parentElement;
    }
    const getTop = () =>
      scrollTarget instanceof Window
        ? scrollTarget.scrollY
        : (scrollTarget as HTMLElement).scrollTop;
    const onScroll = () => {
      const top = getTop();
      setScrollHidden(top > 10);
    };
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      scrollTarget?.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Close emoji picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

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
      if (res?.ok) {
        setDraft("");
        if (res.message) {
          const msg = res.message as ChatMessage;
          setMessages((prev) =>
            prev.some((p) => p.id === msg.id) ? prev : [...prev, msg],
          );
        }
      }
    } finally {
      setSending(false);
    }
  };

  const onEmojiPick = (emoji: string) => {
    setDraft((d) => d + emoji);
    setPickerOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={`rounded-md border bg-white ${
        scrollHidden ? "invisible h-0 overflow-hidden m-0 border-0 p-0" : "mb-1 mt-3"
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
      >
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <span className="text-xl leading-none">{collapsed ? "▾" : "▴"}</span>
            <span>{collapsed ? "ukázat" : "schovat"}</span>
          </span>
          <span>Chat 💬</span>
          {collapsed && unread > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
        <span></span>
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
                // Admins → amber text, no bg. Players → custom bg/text_color from profile
                // if set, otherwise stable fallback from FALLBACK_COLORS.
                const isAdmin = !!p?.is_admin;
                const hasCustomColors = !!(p?.bg_color || p?.text_color);
                const fb = !isAdmin && !hasCustomColors ? fallbackColor(m.user_id) : null;
                const nameBg = p?.bg_color ?? fb?.bg ?? undefined;
                const nameFg = p?.text_color ?? fb?.fg ?? undefined;
                const nameStyle: React.CSSProperties | undefined =
                  isAdmin
                    ? undefined
                    : { backgroundColor: nameBg, color: nameFg };
                const nameCls = isAdmin
                  ? "text-amber-700"
                  : (nameBg ? "px-1.5" : "text-neutral-700");
                return (
                  <div
                    key={m.id}
                    className="mb-1 flex flex-wrap items-baseline gap-x-1.5 leading-snug"
                  >
                    <span
                      className="shrink-0 text-[10px] text-neutral-400 tabular-nums"
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {formatTimestamp(m.created_at)}
                    </span>
                    <span
                      className={`shrink-0 rounded font-medium ${nameCls}`}
                      style={nameStyle}
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {name}:
                    </span>
                    <span className="min-w-0 flex-1 break-words text-neutral-800">
                      {renderContent(m.content)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          {canPost ? (
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center gap-2 border-t bg-neutral-50 p-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Napiš zprávu…"
                maxLength={MAX_LEN}
                className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-sky-300"
                style={{ fontSize: "16px" }}
                disabled={sending}
              />
              <div ref={pickerWrapRef} className="relative hidden shrink-0 md:block">
                <button
                  type="button"
                  onClick={() => setPickerOpen((p) => !p)}
                  className="rounded border bg-white px-2 py-1 text-base hover:bg-neutral-100"
                  aria-label="Přidat emoji"
                  title="Přidat emoji"
                >
                  😊
                </button>
                {pickerOpen && (
                  <div className="absolute bottom-full right-0 z-50 mb-2">
                    <EmojiPicker
                      onEmojiClick={(e) => onEmojiPick(e.emoji)}
                      width={300}
                      height={350}
                      lazyLoadEmojis
                      previewConfig={{ showPreview: false }}
                      searchPlaceholder="Hledat emoji…"
                    />
                  </div>
                )}
              </div>
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
