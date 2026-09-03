"use client";

import { useEffect, useState } from "react";

interface Rule {
  id: string;
  examSystemId: string;
  topic: string;
  title: string;
  body: string;
  officialUrl: string | null;
  updatedAt: string;
}

const EMPTY_FORM = { topic: "", title: "", ruleBody: "", officialUrl: "" };

export default function AdminRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadRules() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules?exam=JOSAA");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load rules.");
      setRules(data.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  function startEdit(rule: Rule) {
    setEditingId(rule.id);
    setEditForm({
      topic: rule.topic,
      title: rule.title,
      ruleBody: rule.body,
      officialUrl: rule.officialUrl ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save rule.");
      cancelEdit();
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  }

  async function createRule() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSystemCode: "JOSAA", ...newForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create rule.");
      setNewForm(EMPTY_FORM);
      setShowNewForm(false);
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rules?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete rule.");
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Counseling Rules</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage the grounded rule set the AI counselor uses to answer Freeze/Float/Slide,
            withdrawal, and refund questions. These are looked up directly - the AI never
            invents policy language.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showNewForm ? "Cancel" : "+ Add Rule"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showNewForm && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800">New Rule</h3>
          <div className="mt-3 grid gap-3">
            <input
              placeholder="Topic (e.g. FREEZE, FLOAT, SLIDE, WITHDRAWAL, REFUND)"
              value={newForm.topic}
              onChange={(e) => setNewForm({ ...newForm, topic: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Title"
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Rule body text"
              value={newForm.ruleBody}
              onChange={(e) => setNewForm({ ...newForm, ruleBody: e.target.value })}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="Official URL (optional)"
              value={newForm.officialUrl}
              onChange={(e) => setNewForm({ ...newForm, officialUrl: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={createRule}
              disabled={saving}
              className="justify-self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Rule"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading rules...</p>
      ) : rules.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No rules yet for JOSAA. Add one above.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-5">
              {editingId === rule.id ? (
                <div className="grid gap-3">
                  <input
                    value={editForm.topic}
                    onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={editForm.ruleBody}
                    onChange={(e) => setEditForm({ ...editForm, ruleBody: e.target.value })}
                    rows={3}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={editForm.officialUrl}
                    onChange={(e) => setEditForm({ ...editForm, officialUrl: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(rule.id)}
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {rule.topic}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">{rule.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{rule.body}</p>
                    {rule.officialUrl && (<a href={rule.officialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-600 hover:underline">{rule.officialUrl}</a>)}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => startEdit(rule)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}