"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChoiceTable from "@/components/ChoiceTable";
import { exportCsv, exportPdf } from "@/lib/export";
import { lintChoiceList } from "@/lib/linter";
import { createClient } from "@/lib/supabase/client";
import type { ChoiceListItem, LintIssue, StudentProfileInput } from "@/lib/types";
import { AlertTriangle, ArrowRight, Download, FileText, Save } from "lucide-react";
import CountUp from "@/components/ui/CountUp";
import Link from "next/link";

export default function ResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfileInput | null>(null);
  const [items, setItems] = useState<ChoiceListItem[]>([]);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const p = sessionStorage.getItem("opencounsel:profile");
    const r = sessionStorage.getItem("opencounsel:results");
    if (!p || !r) {
      router.push("/profile");
      return;
    }
    const parsedProfile = JSON.parse(p) as StudentProfileInput;
    const parsedResults = JSON.parse(r);
    setProfile(parsedProfile);
    setItems(parsedResults.items ?? []);
    setIssues(parsedResults.lintIssues ?? []);
  }, [router]);

  useEffect(() => {
    if (profile && items.length) {
      setIssues(lintChoiceList(items, profile));
    }
  }, [items, profile]);

  async function handleSave() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/results");
      return;
    }

    setSaveState("saving");
    try {
      const res = await fetch("/api/save-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, items }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (!profile) return <div className="p-8 text-center text-slate-500" role="status">Loading your list...</div>;

  const dream = items.filter((i) => i.riskBand === "DREAM");
  const target = items.filter((i) => i.riskBand === "TARGET");
  const safe = items.filter((i) => i.riskBand === "SAFE");
  const jeeMainRank = profile.categoryRank ?? profile.crlRank;
  const jeeAdvRank = profile.jeeAdvancedCategoryRank ?? profile.jeeAdvancedRank;
  const visibleItems = items;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="card p-5 sm:p-6">
        <h1 className="page-title">Your Admission Snapshot</h1>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 sm:grid-cols-4">
          <p><span className="font-semibold text-slate-800">JEE Main Rank:</span> {jeeMainRank ? jeeMainRank.toLocaleString("en-IN") : "-"}</p>
          {jeeAdvRank && (
            <p><span className="font-semibold text-slate-800">JEE Advanced Rank:</span> {jeeAdvRank.toLocaleString("en-IN")}</p>
          )}
          <p><span className="font-semibold text-slate-800">Category:</span> {profile.category}</p>
          <p><span className="font-semibold text-slate-800">Home State:</span> {profile.homeState}</p>
          <p><span className="font-semibold text-slate-800">Counseling:</span> {profile.examSystemCode}</p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-3xl font-extrabold text-purple-700"><CountUp value={dream.length} /></p>
          <p className="text-sm font-medium text-purple-700">Dream</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-3xl font-extrabold text-amber-700"><CountUp value={target.length} /></p>
          <p className="text-sm font-medium text-amber-700">Target</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-3xl font-extrabold text-emerald-700"><CountUp value={safe.length} /></p>
          <p className="text-sm font-medium text-emerald-700">Safe</p>
        </div>
      </section>

      <p className="notice mt-4">
        These are historical-data-based estimates, not guarantees. Verify against the latest
        official counseling notification before making irreversible decisions.
      </p>

      {issues.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Potential Risks & Warnings
          </h2>
          {issues.map((issue, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 text-sm ${
                issue.severity === "ERROR"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {issue.message}
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Your Choice Strategy (drag to reorder)</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={saveState === "saving" || saveState === "saved"}
              className="btn-secondary btn-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {saveState === "saved"
                ? "Saved!"
                : saveState === "saving"
                ? "Saving..."
                : saveState === "error"
                ? "Retry save"
                : "Save my list"}
            </button>
            <button
              onClick={() => exportCsv(items)}
              className="btn-ghost btn-sm"
            >
              <FileText className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => exportPdf(items, profile)}
              className="btn-ghost btn-sm"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        <ChoiceTable items={visibleItems} setItems={setItems} />
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/simulator"
          className="btn-primary px-6 py-3 text-base"
        >
          Simulate Round-by-Round Outcomes <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

    </div>
  );
}