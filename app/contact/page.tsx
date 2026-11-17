"use client";

import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="page-title">Contact & Support</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Report a wrong cutoff, an eligibility issue, or an AI answer
        that seems incorrect. We read every message.
      </p>
      {sent ? (
        <div role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          Thanks — your message has been recorded. We'll get back to you by email.
        </div>
      ) : (
        <form
          className="card mt-6 space-y-4 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            Your email
            <input type="email" required className="field" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Category
            <select className="field">
              <option>Wrong cutoff data</option>
              <option>Eligibility / quota issue</option>
              <option>AI answer problem</option>
              <option>Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Message
            <textarea required rows={5} className="field" />
          </label>
          <button type="submit" className="btn-primary">
            Send message
          </button>
        </form>
      )}
    </div>
  );
}
