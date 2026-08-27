"use client";

import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Contact & Support</h1>
      <p className="mt-2 text-sm text-slate-600">
        Report a wrong cutoff, an eligibility issue, a payment problem, or an AI answer
        that seems incorrect. We read every message.
      </p>
      {sent ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          Thanks — your message has been recorded. We'll get back to you by email.
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="block text-sm">
            Your email
            <input type="email" required className="mt-1 w-full rounded-md border border-slate-300 p-2" />
          </label>
          <label className="block text-sm">
            Category
            <select className="mt-1 w-full rounded-md border border-slate-300 p-2">
              <option>Wrong cutoff data</option>
              <option>Eligibility / quota issue</option>
              <option>Payment problem</option>
              <option>AI answer problem</option>
              <option>Other</option>
            </select>
          </label>
          <label className="block text-sm">
            Message
            <textarea required rows={5} className="mt-1 w-full rounded-md border border-slate-300 p-2" />
          </label>
          <button type="submit" className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white">
            Send message
          </button>
        </form>
      )}
    </div>
  );
}
