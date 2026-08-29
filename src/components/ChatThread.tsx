"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendChatMessage } from "@/lib/actions/chat";
import { track } from "@/lib/analytics/client";
import { he } from "@/data/he";

interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
}

export function ChatThread({
  txId,
  initial,
  counterpartyName,
}: {
  txId: string;
  initial: Msg[];
  counterpartyName: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  async function poll() {
    try {
      const res = await fetch(`/api/chat/${txId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { messages: Msg[] };
      setMessages(json.messages);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    track("chat_opened", {}, { tx_id: txId });
    const t = setInterval(poll, 4000);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    // optimistic
    setMessages((m) => [
      ...m,
      {
        id: "tmp-" + Date.now(),
        sender_id: "me",
        body,
        created_at: new Date().toISOString(),
        mine: true,
      },
    ]);
    start(async () => {
      await sendChatMessage(txId, body);
      poll();
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="flex-1 space-y-2 p-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-stone-400">
            {he.chat.empty(counterpartyName)}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.mine
                  ? "bg-blush-500 text-white"
                  : "bg-white text-ink border border-blush-100"
              }`}
            >
              {m.body}
              <span
                className={`mt-0.5 block text-[10px] ${
                  m.mine ? "text-white/70" : "text-stone-400"
                }`}
              >
                {new Date(m.created_at).toLocaleTimeString("he-IL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-[4.25rem] flex gap-2 border-t border-blush-100 bg-paper p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={he.chat.placeholder}
          className="flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm"
        />
        <button
          disabled={pending || !text.trim()}
          onClick={submit}
          className="rounded-full bg-blush-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {he.chat.send}
        </button>
      </div>
    </div>
  );
}
