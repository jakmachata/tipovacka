"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  sendChatMessage,
  deleteChatMessage,
  editChatMessage,
} from "@/app/(app)/chat-actions";

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
  edited_at: string | null;
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
  isAdmin: boolean;
}

const STORAGE_COLLAPSED = "chat_collapsed";
const STORAGE_LAST_SEEN = "chat_last_seen_id";
const MAX_LEN = 500;
const EDIT_WINDOW_MS = 10 * 60 * 1000;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

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
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
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
  isAdmin,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [lastSeenId, setLastSeenId] = useState<number>(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Hydrace z localStorage
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_COLLAPSED) === "1");
    const raw = localStorage.getItem(STORAGE_LAST_SEEN);
    setLastSeenId(raw ? parseInt(raw, 10) || 0 : 0);
    setHydrated(true);
  }, []);

  // Tick — refresh nowMs aby Upravit/Smazat zmizely po vyprseni 10 min okna
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime: INSERT + UPDATE + DELETE
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
      } catch {}
      if (cancelled) return;
      channel = supabase
        .channel("chat-room")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const m = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.some((p) => p.id === m.id) ? prev : [...prev, m],
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "chat_messages" },
          (payload) => {
            const m = payload.new as ChatMessage;
            setMessages((prev) => prev.map((p) => (p.id === m.id ? m : p)));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "chat_messages" },
          (payload) => {
            const old = payload.old as { id?: number };
            if (!old?.id) return;
            setMessages((prev) => prev.filter((p) => p.id !== old.id));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        const sb2 = createClient();
        sb2.removeChannel(channel);
      }
    };
  }, []);

  // Auto-scroll na konec
  useLayoutEffect(() => {
    if (!collapsed && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  // Mark as read
  useEffect(() => {
    if (!hydrated || collapsed) return;
    const maxId = messages.reduce((m, x) => (x.id > m ? x.id : m), 0);
    if (maxId > lastSeenId) {
      setLastSeenId(maxId);
      localStorage.setItem(STORAGE_LAST_SEEN, String(maxId));
    }
  }, [messages, collapsed, hydrated, lastSeenId]);

  // Close picker on outside click
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

  // Focus na edit input
  useEffect(() => {
    if (editingId != null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const unread = hydrated ? messages.filter((m) => m.id > lastSeenId).length : 0;

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

  // Permission helpers
  const canEditMsg = (m: ChatMessage) => {
    if (!currentUserId) return false;
    if (m.user_id !== currentUserId) return false;
    return nowMs - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
  };
  const canDeleteMsg = (m: ChatMessage) => {
    if (isAdmin) return true;
    return canEditMsg(m);
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const text = editDraft.trim();
    if (!text) return cancelEdit();
    const res = await editChatMessage(editingId, text);
    if (res?.ok && res.message) {
      const updated = res.message as ChatMessage;
      setMessages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      cancelEdit();
    } else {
      alert("Úprava selhala: " + (res?.error ?? "?"));
    }
  };

  const onDelete = async (m: ChatMessage) => {
    if (!confirm("Smazat zprávu?")) return;
    setMessages((prev) => prev.filter((p) => p.id !== m.id));
    const res = await deleteChatMessage(m.id);
    if (!res?.ok) {
      setMessages((prev) =>
        prev.some((p) => p.id === m.id)
          ? prev
          : [...prev, m].sort((a, b) => a.id - b.id),
      );
      alert("Smazání selhalo: " + (res?.error ?? "?"));
    }
  };

  return (
    <div className="mb-3 mt-10 rounded-md border bg-white">
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
      >
        <span className="flex items-center gap-2">
          <span className="text-3xl leading-none">{collapsed ? "▾" : "▴"}</span>
          <span>Chat 💬</span>
          {collapsed && unread > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500">{collapsed ? "ukázat" : "schovat"}</span>
      </button>
      {!collapsed && (
        <div className="border-t">
          <div ref={listRef} className="h-[150px] overflow-y-auto px-3 py-2 text-sm">
            {messages.length === 0 ? (
              <div className="py-6 text-center text-neutral-400">Žádné zprávy. Buď první!</div>
            ) : (
              messages.map((m) => {
                const p = profiles[m.user_id];
                const name = p?.display_name ?? "?";
                const nameCls = p?.is_admin ? "text-amber-700" : "text-neutral-700";
                const isEditing = editingId === m.id;
                const showEdit = canEditMsg(m);
                const showDelete = canDeleteMsg(m);
                return (
                  <div
                    key={m.id}
                    className="group mb-1 flex flex-wrap items-baseline gap-x-1.5 leading-snug"
                  >
                    {(showEdit || showDelete) && !isEditing && (
                      <span className="mr-1 inline-flex shrink-0 items-center gap-1">
                        {showEdit && (
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="rounded px-1 leading-none text-[20px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                            title="Upravit"
                          >
                            ✎
                          </button>
                        )}
                        {showDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(m)}
                            className="rounded px-1 leading-none text-[20px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            title="Smazat"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    )}
                    <span
                      className="shrink-0 text-[10px] text-neutral-400 tabular-nums"
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {formatTimestamp(m.created_at)}
                    </span>
                    <span
                      className={`shrink-0 font-medium ${nameCls}`}
                      title={new Date(m.created_at).toLocaleString("cs-CZ")}
                    >
                      {name}:
                    </span>
                    {isEditing ? (
                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        <input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit();
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          maxLength={MAX_LEN}
                          className="min-w-0 flex-1 rounded border bg-white px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-300"
                          style={{ fontSize: "16px" }}
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded bg-sky-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-sky-700"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-300"
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <span className="min-w-0 flex-1 break-words text-neutral-800">
                        {renderContent(m.content)}
                        {m.edited_at && (
                          <span
                            className="ml-1 text-[10px] text-neutral-400"
                            title={`Upraveno: ${new Date(m.edited_at).toLocaleString("cs-CZ")}`}
                          >
                            (upraveno)
                          </span>
                        )}
                      </span>
                    )}
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
