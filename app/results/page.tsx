"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChoiceTable from "@/components/ChoiceTable";
import DonationModal from "@/components/DonationModal";
import { exportCsv, exportPdf } from "@/lib/export";
import { lintChoiceList } from "@/lib/linter";
import { PAYMENTS_ENABLED, PRICE_PAISE } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { ChoiceListItem, LintIssue, StudentProfileInput } from "@/lib/types";
import { AlertTriangle, Download, FileText, Save } from "lucide-react";
import Link from "next/link";

export default function ResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfileInput | null>(null);
  const [items, setItems] = useState<ChoiceListItem[]>([]);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [showDonation, setShowDonation] = useState(false);
  const [unlocked, setUnlocked] = useState(!PAYMENTS_ENABLED);
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

  if (!profile) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const dream = items.filter((i) => i.riskBand === "DREAM");
  const target = items.filter((i) => i.riskBand === "TARGET");
  const safe = items.filter((i) => i.riskBand === "SAFE");
  const jeeMainRank = profile.categoryRank ?? profile.crlRank;
  const jeeAdvRank = profile.jeeAdvancedCategoryRank ?? profile.jeeAdvancedRank;
  const visibleItems = unlocked ? items : items.slice(0, 5);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold text-slate-900">Your Admission Snapshot</h1>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
          <p><span className="font-semibold">JEE Main Rank:</span> {jeeMainRank ? jeeMainRank.toLocaleString("en-IN") : "-"}</p>
          {jeeAdvRank && (
            <p><span className="font-semibold">JEE Advanced Rank:</span> {jeeAdvRank.toLocaleString("en-IN")}</p>
          )}
          <p><span className="font-semibold">Category:</span> {profile.category}</p>
          <p><span className="font-semibold">Home State:</span> {profile.homeState}</p>
          <p><span className="font-semibold">Counseling:</span> {profile.examSystemCode}</p>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <p className="text-2xl font-bold text-purple-700">{dream.length}</p>
          <p className="text-xs text-purple-700">Dream</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-2xl font-bold text-amber-700">{target.length}</p>
          <p className="text-xs text-amber-700">Target</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{safe.length}</p>
          <p className="text-xs text-emerald-700">Safe</p>
        </div>
      </section>

      <p className="mt-4 rounded-md bg-slate-100 p-3 text-xs text-slate-600">
        These are historical-data-based estimates, not guarantees. Verify against the latest
        official counseling notification before making irreversible decisions.
      </p>

      {issues.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Potential Risks & Warnings
          </h2>
          {issues.map((issue, i) => (
            <div
              key={i}
              className={`rounded-md border p-2 text-xs ${
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Your Choice Strategy (drag to reorder)</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveState === "saving" || saveState === "saved"}
              className="flex items-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 disabled:opacity-60"
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
              disabled={!unlocked}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
            >
              <FileText className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => exportPdf(items, profile)}
              disabled={!unlocked}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        {!unlocked && (
          <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4 text-center">
            <p className="text-sm font-semibold text-brand-800">
              Showing top 5 of {items.length} recommendations.
            </p>
            <p className="mt-1 text-xs text-brand-700">
              Unlock Complete Choice List - Rs.{PRICE_PAISE / 100}
            </p>
            <button
              onClick={() => setUnlocked(true)}
              className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Unlock full report (dev mode)
            </button>
          </div>
        )}

        <ChoiceTable items={visibleItems} setItems={unlocked ? setItems : () => {}} />
      </section>

      <div className="mt-6 text-center">
        <Link
          href="/simulator"
          className="inline-block rounded-lg border border-brand-300 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
        >
          Simulate Round-by-Round Outcomes -&gt;
        </Link>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => setShowDonation(true)}
          className="text-sm text-brand-600 underline"
        >
          Support OpenCounsel - buy us a coffee
        </button>
      </div>

      {showDonation && <DonationModal onClose={() => setShowDonation(false)} />}
    </div>
  );
}