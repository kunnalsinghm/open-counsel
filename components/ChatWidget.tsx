"use client";

import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Explain Freeze, Float and Slide.",
  "What should I do if I get my 20th choice in Round 1?",
  "Make my choice list safer.",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    if (!text.trim()) return;
    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Sorry, I couldn't answer that." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
        aria-label="Open AI Admission Counselor"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[28rem] w-80 flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <span className="text-sm font-semibold text-slate-800">AI Admission Counselor</span>
        <button onClick={() => setOpen(false)} aria-label="Close chat">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Try asking:</p>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="block w-full rounded-md border border-slate-200 p-2 text-left text-xs text-slate-600 hover:bg-slate-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-lg p-2 text-xs ${
              m.role === "user" ? "ml-6 bg-brand-600 text-white" : "mr-6 bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-400">Thinking…</p>}
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about cutoffs or rules…"
          className="flex-1 rounded-md border border-slate-300 p-2 text-xs"
        />
        <button onClick={() => send(input)} className="rounded-md bg-brand-600 px-3 text-white">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
