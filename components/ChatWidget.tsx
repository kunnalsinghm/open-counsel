"use client";
import { useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

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
  const [sessionId, setSessionId] = useState<string | null>(null);

  async function send(text: string) {
    if (!text.trim()) return;
    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const withPlaceholder = [...next, { role: "assistant", content: "" } as Msg];
    setMessages(withPlaceholder);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          // Last few finished turns so follow-up questions make sense.
          history: messages
            .filter((m) => m.content.trim())
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        // Show the server's own reason (e.g. "Please log in", daily limit reached).
        let reason = "Sorry, I couldn't answer that.";
        try {
          const err = await res.json();
          if (typeof err?.error === "string") reason = err.error;
        } catch {}
        setMessages([...next, { role: "assistant", content: reason }]);
        return;
      }

      const newSession = res.headers.get("x-chat-session");
      if (newSession) setSessionId(newSession);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let first = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (first) {
          setLoading(false);
          first = false;
        }
        setMessages([...next, { role: "assistant", content: accumulated }]);
      }

      if (!accumulated) {
        setMessages([...next, { role: "assistant", content: "Sorry, I couldn't generate a response." }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error - please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <motion.button
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
        aria-label="Open AI Admission Counselor"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed bottom-5 right-5 z-40 flex h-[28rem] max-h-[calc(100vh-2.5rem)] w-[calc(100vw-2.5rem)] max-w-sm origin-bottom-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
    >
      <div className="flex items-center justify-between bg-brand-600 p-3 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" aria-hidden /> AI Admission Counselor
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-md p-1 hover:bg-white/15">
          <X className="h-4 w-4" />
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
                className="block w-full rounded-xl border border-slate-200 p-2.5 text-left text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
              m.role === "user" ? "ml-6 rounded-br-sm bg-brand-600 text-white" : "mr-6 rounded-bl-sm bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-400">Thinking...</p>}
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Ask about cutoffs or rules..."
          className="flex-1 rounded-xl border border-slate-300 p-2 text-xs focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <button onClick={() => send(input)} aria-label="Send message" className="rounded-xl bg-brand-600 px-3 text-white transition hover:bg-brand-700">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}