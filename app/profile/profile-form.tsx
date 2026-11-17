"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BRANCH_OPTIONS = ["CSE", "ECE", "EE", "ME", "CE"];
const TYPE_OPTIONS = ["IIT", "NIT", "IIIT", "GFTI"];
const CATEGORY_OPTIONS = ["OPEN", "EWS", "OBC-NCL", "SC", "ST", "PwD"];
const QUOTA_OPTIONS = ["HS", "OS", "AI", "GO"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Gujarat", "Haryana", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other",
];

export default function ProfileForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    examSystemCode: "JOSAA",
    year: 2024,
    round: 6,
    crlRank: "",
    categoryRank: "",
    appearedJeeAdvanced: false,
    jeeAdvancedRank: "",
    jeeAdvancedCategoryRank: "",
    category: "OPEN",
    gender: "MALE" as "MALE" | "FEMALE" | "OTHER",
    homeState: "West Bengal",
    domicileState: "West Bengal",
    quota: "OS",
    seatPool: "Gender-Neutral" as "Gender-Neutral" | "Female-Only",
    preferredBranches: ["CSE", "ECE"] as string[],
    preferredInstituteTypes: ["NIT", "IIIT"] as string[],
    preferenceWeighting: "BALANCED" as "COLLEGE_OVER_BRANCH" | "BRANCH_OVER_COLLEGE" | "BALANCED",
  });

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        crlRank: form.crlRank ? Number(form.crlRank) : undefined,
        categoryRank: form.categoryRank ? Number(form.categoryRank) : undefined,
        jeeAdvancedRank:
          form.appearedJeeAdvanced && form.jeeAdvancedRank
            ? Number(form.jeeAdvancedRank)
            : undefined,
        jeeAdvancedCategoryRank:
          form.appearedJeeAdvanced && form.jeeAdvancedCategoryRank
            ? Number(form.jeeAdvancedCategoryRank)
            : undefined,
      };
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      sessionStorage.setItem("opencounsel:profile", JSON.stringify(payload));
      sessionStorage.setItem("opencounsel:results", JSON.stringify(data));
      router.push("/results");
    } catch (err) {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="page-title">Build My Choice List</h1>
        <p className="mt-1 text-sm text-slate-500">Four short steps. Nothing is saved unless you choose to save your list.</p>
      </div>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900"><span className="step-badge">1</span>Counseling</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">
            Exam
            <select
              className="field"
              value={form.examSystemCode}
              onChange={(e) => setForm({ ...form, examSystemCode: e.target.value })}
            >
              <option value="JOSAA">JoSAA</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Year
            <input
              type="number"
              className="field"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900"><span className="step-badge">2</span>Rank</h2>
        <p className="text-xs text-slate-500">
          JoSAA allocates NIT / IIIT / GFTI seats using your JEE Main rank, and IIT seats
          using your JEE Advanced rank — these are different exams with different rank
          pools. Fill in whichever apply to you.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">
            JEE Main CRL Rank
            <input
              type="number"
              className="field"
              value={form.crlRank}
              onChange={(e) => setForm({ ...form, crlRank: e.target.value })}
              placeholder="e.g. 18421"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            JEE Main Category Rank (optional)
            <input
              type="number"
              className="field"
              value={form.categoryRank}
              onChange={(e) => setForm({ ...form, categoryRank: e.target.value })}
            />
          </label>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              checked={form.appearedJeeAdvanced}
              onChange={(e) =>
                setForm({ ...form, appearedJeeAdvanced: e.target.checked })
              }
            />
            I appeared for JEE Advanced (required for any IIT recommendations)
          </label>
          {form.appearedJeeAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="text-sm font-medium text-slate-700">
                JEE Advanced AIR (All-India Rank)
                <input
                  type="number"
                  className="field"
                  value={form.jeeAdvancedRank}
                  onChange={(e) =>
                    setForm({ ...form, jeeAdvancedRank: e.target.value })
                  }
                  placeholder="e.g. 3200"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                JEE Advanced Category Rank (optional)
                <input
                  type="number"
                  className="field"
                  value={form.jeeAdvancedCategoryRank}
                  onChange={(e) =>
                    setForm({ ...form, jeeAdvancedCategoryRank: e.target.value })
                  }
                />
              </label>
            </div>
          )}
        </div>
        <label className="text-sm font-medium text-slate-700">
          Category
          <select
            className="field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900"><span className="step-badge">3</span>Eligibility</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium text-slate-700">
            Gender / Seat Pool eligibility
            <select
              className="field"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Seat Pool
            <select
              className="field"
              value={form.seatPool}
              onChange={(e) => setForm({ ...form, seatPool: e.target.value as any })}
            >
              <option value="Gender-Neutral">Gender-Neutral</option>
              <option value="Female-Only">Female-Only</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Home State
            <select
              className="field"
              value={form.homeState}
              onChange={(e) => setForm({ ...form, homeState: e.target.value })}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Domicile State
            <select
              className="field"
              value={form.domicileState}
              onChange={(e) => setForm({ ...form, domicileState: e.target.value })}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Quota
            <select
              className="field"
              value={form.quota}
              onChange={(e) => setForm({ ...form, quota: e.target.value })}
            >
              {QUOTA_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-900"><span className="step-badge">4</span>Preferences</h2>
        <div>
          <p className="mb-2 text-sm text-slate-600">Preferred branches</p>
          <div className="flex flex-wrap gap-2">
            {BRANCH_OPTIONS.map((b) => (
              <button
                type="button"
                key={b}
                onClick={() =>
                  setForm({ ...form, preferredBranches: toggle(form.preferredBranches, b) })
                }
                aria-pressed={form.preferredBranches.includes(b)}
                className={`chip ${
                  form.preferredBranches.includes(b) ? "chip-on" : "chip-off"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-slate-600">Preferred institute types</p>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() =>
                  setForm({
                    ...form,
                    preferredInstituteTypes: toggle(form.preferredInstituteTypes, t),
                  })
                }
                aria-pressed={form.preferredInstituteTypes.includes(t)}
                className={`chip ${
                  form.preferredInstituteTypes.includes(t) ? "chip-on" : "chip-off"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-slate-600">
            College importance ←→ Branch importance
          </p>
          <div className="flex gap-2">
            {(
              [
                ["COLLEGE_OVER_BRANCH", "College first"],
                ["BALANCED", "Balanced"],
                ["BRANCH_OVER_COLLEGE", "Branch first"],
              ] as const
            ).map(([val, label]) => (
              <button
                type="button"
                key={val}
                onClick={() => setForm({ ...form, preferenceWeighting: val })}
                aria-pressed={form.preferenceWeighting === val}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm transition ${
                  form.preferenceWeighting === val
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700 ring-2 ring-brand-100"
                    : "border-slate-300 bg-white text-slate-700 hover:border-brand-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full py-3 text-base"
      >
        {submitting ? "Generating…" : "Generate My Recommendations"}
      </button>
    </form>
  );
}