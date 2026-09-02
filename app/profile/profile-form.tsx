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
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Build My Choice List</h1>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-800">1. Counseling</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Exam
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.examSystemCode}
              onChange={(e) => setForm({ ...form, examSystemCode: e.target.value })}
            >
              <option value="JOSAA">JoSAA</option>
            </select>
          </label>
          <label className="text-sm">
            Year
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-800">2. Rank</h2>
        <p className="text-xs text-slate-500">
          JoSAA allocates NIT / IIIT / GFTI seats using your JEE Main rank, and IIT seats
          using your JEE Advanced rank — these are different exams with different rank
          pools. Fill in whichever apply to you.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            JEE Main CRL Rank
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.crlRank}
              onChange={(e) => setForm({ ...form, crlRank: e.target.value })}
              placeholder="e.g. 18421"
            />
          </label>
          <label className="text-sm">
            JEE Main Category Rank (optional)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.categoryRank}
              onChange={(e) => setForm({ ...form, categoryRank: e.target.value })}
            />
          </label>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.appearedJeeAdvanced}
              onChange={(e) =>
                setForm({ ...form, appearedJeeAdvanced: e.target.checked })
              }
            />
            I appeared for JEE Advanced (required for any IIT recommendations)
          </label>
          {form.appearedJeeAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="text-sm">
                JEE Advanced AIR (All-India Rank)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 p-2"
                  value={form.jeeAdvancedRank}
                  onChange={(e) =>
                    setForm({ ...form, jeeAdvancedRank: e.target.value })
                  }
                  placeholder="e.g. 3200"
                />
              </label>
              <label className="text-sm">
                JEE Advanced Category Rank (optional)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-slate-300 p-2"
                  value={form.jeeAdvancedCategoryRank}
                  onChange={(e) =>
                    setForm({ ...form, jeeAdvancedCategoryRank: e.target.value })
                  }
                />
              </label>
            </div>
          )}
        </div>
        <label className="text-sm">
          Category
          <select
            className="mt-1 w-full rounded-md border border-slate-300 p-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-800">3. Eligibility</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Gender / Seat Pool eligibility
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-sm">
            Seat Pool
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.seatPool}
              onChange={(e) => setForm({ ...form, seatPool: e.target.value as any })}
            >
              <option value="Gender-Neutral">Gender-Neutral</option>
              <option value="Female-Only">Female-Only</option>
            </select>
          </label>
          <label className="text-sm">
            Home State
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.homeState}
              onChange={(e) => setForm({ ...form, homeState: e.target.value })}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Domicile State
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
              value={form.domicileState}
              onChange={(e) => setForm({ ...form, domicileState: e.target.value })}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Quota
            <select
              className="mt-1 w-full rounded-md border border-slate-300 p-2"
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

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-800">4. Preferences</h2>
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
                className={`rounded-full border px-3 py-1 text-sm ${
                  form.preferredBranches.includes(b)
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-700"
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
                className={`rounded-full border px-3 py-1 text-sm ${
                  form.preferredInstituteTypes.includes(t)
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-700"
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
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  form.preferenceWeighting === val
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Generating…" : "Generate My Recommendations"}
      </button>
    </form>
  );
}