"use client";

import { useEffect, useState } from "react";

interface SummaryGroup {
  instituteId: string;
  instituteName: string | null;
  branchId: string;
  branchName: string | null;
  totalCount: number;
  realCount: number;
}

interface CutoffRow {
  id: string;
  instituteId: string;
  instituteName: string | null;
  branchId: string;
  branchName: string | null;
  year: number;
  round: number;
  quota: string;
  seatPool: string;
  category: string;
  openingRank: number;
  closingRank: number;
  dataVersion: string;
  sourceUrl: string | null;
  isUnavailable: boolean;
}

interface IngestionIssue {
  severity: "ERROR" | "WARNING";
  rowNumber: number;
  code: string;
  message: string;
}

interface UploadReport {
  totalRows: number;
  validRows: number;
  errors: IngestionIssue[];
  warnings: IngestionIssue[];
  newInstitutes: string[];
  newBranches: string[];
  committed: boolean;
  inserted: number;
  updated: number;
  skippedAsDuplicateOfPublished: number;
}

function UploadSection({ onCommitted }: { onCommitted: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [examSystemCode, setExamSystemCode] = useState("JOSAA");
  const [dataVersion, setDataVersion] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"idle" | "checking" | "committing">("idle");

  async function runUpload(commit: boolean) {
    if (!file) return;
    setUploadError(null);
    setBusy(commit ? "committing" : "checking");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("examSystemCode", examSystemCode);
      body.set("dataVersion", dataVersion || `upload-${Date.now()}`);
      body.set("commit", commit ? "true" : "false");
      body.set("overwrite", overwrite ? "true" : "false");

      const res = await fetch("/api/admin/cutoffs/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
        setReport(null);
        return;
      }
      setReport(data);
      if (data.committed) onCommitted();
    } catch (e) {
      setUploadError("Network error — check your connection and try again.");
    } finally {
      setBusy("idle");
    }
  }

  const canCommit = report && report.errors.length === 0 && !report.committed;

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">Upload cutoff data</h3>
      <p className="mt-1 text-xs text-slate-500">
        CSV only. Columns required: year, round, instituteName, instituteType, state, branchName,
        branchShortCode, quota, seatPool, category, openingRank, closingRank (sourceUrl optional).
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">CSV file</span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setUploadError(null);
            }}
            className="text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">Exam system code</span>
          <input
            value={examSystemCode}
            onChange={(e) => setExamSystemCode(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">Data version label</span>
          <input
            value={dataVersion}
            onChange={(e) => setDataVersion(e.target.value)}
            placeholder="e.g. josaa-2026-round1"
            className="rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          <span className="text-slate-600">Overwrite existing records</span>
        </label>
        <button
          onClick={() => runUpload(false)}
          disabled={!file || busy !== "idle"}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
        >
          {busy === "checking" ? "Checking..." : "Check file"}
        </button>
        {canCommit && (
          <button
            onClick={() => runUpload(true)}
            disabled={busy !== "idle"}
            className="rounded-md border border-brand-600 bg-brand-600 px-3 py-1.5 font-medium text-white disabled:opacity-40"
          >
            {busy === "committing" ? "Importing..." : `Import ${report!.validRows} rows`}
          </button>
        )}
      </div>

      {uploadError && <p className="mt-3 text-xs text-red-600">{uploadError}</p>}

      {report && (
        <div className="mt-4 space-y-3 text-xs">
          {report.committed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
              Imported. Inserted {report.inserted}, updated {report.updated}, skipped{" "}
              {report.skippedAsDuplicateOfPublished} already-published rows.
            </p>
          ) : (
            <p className="text-slate-600">
              {report.totalRows} rows parsed, {report.validRows} valid, {report.errors.length} error(s),{" "}
              {report.warnings.length} warning(s).
            </p>
          )}

          {report.newInstitutes.length > 0 && (
            <div>
              <span className="font-medium text-slate-700">New institutes ({report.newInstitutes.length}):</span>{" "}
              {report.newInstitutes.join(", ")}
            </div>
          )}
          {report.newBranches.length > 0 && (
            <div>
              <span className="font-medium text-slate-700">New branches ({report.newBranches.length}):</span>{" "}
              {report.newBranches.join(", ")}
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-2">
              <p className="font-medium text-red-800">Errors (must fix before import):</p>
              {report.errors.slice(0, 100).map((e, i) => (
                <p key={i} className="text-red-700">
                  Row {e.rowNumber} [{e.code}]: {e.message}
                </p>
              ))}
            </div>
          )}
          {report.warnings.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-2">
              <p className="font-medium text-amber-800">Warnings (won't block import):</p>
              {report.warnings.slice(0, 100).map((w, i) => (
                <p key={i} className="text-amber-700">
                  Row {w.rowNumber} [{w.code}]: {w.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function AdminDataPage() {
  const [groups, setGroups] = useState<SummaryGroup[]>([]);
  const [rows, setRows] = useState<CutoffRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<"all" | "real" | "mock">("all");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function reloadAfterCommit() {
    setLoadingSummary(true);
    setLoadingTable(true);
    fetch("/api/admin/cutoffs/summary")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
      .finally(() => setLoadingSummary(false));
    setPage(1);
  }

  useEffect(() => {
    fetch("/api/admin/cutoffs/summary")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
      .finally(() => setLoadingSummary(false));
  }, []);

  useEffect(() => {
    setLoadingTable(true);
    const params = new URLSearchParams({ page: String(page) });
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    fetch(`/api/admin/cutoffs?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows ?? []);
        setTotalPages(data.totalPages ?? 1);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoadingTable(false));
  }, [page, sourceFilter]);

  async function toggleUnavailable(id: string, current: boolean) {
    setTogglingId(id);
    try {
      await fetch("/api/admin/cutoffs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isUnavailable: !current }),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isUnavailable: !current } : r))
      );
    } finally {
      setTogglingId(null);
    }
  }

  const gapGroups = groups.filter((g) => g.realCount === 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Cutoff Data</h2>
      <p className="mt-1 text-sm text-slate-500">
        Coverage summary by branch, and the full record browser below.
      </p>

      <UploadSection onCommitted={reloadAfterCommit} />

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Coverage Gaps ({gapGroups.length} of {groups.length} branches have zero real data)
        </h3>
        {loadingSummary ? (
          <p className="mt-2 text-sm text-slate-400">Loading summary...</p>
        ) : (
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Institute</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Total Records</th>
                  <th className="px-3 py-2">Real Records</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={`${g.instituteId}-${g.branchId}`}
                    className={`border-t border-slate-100 ${g.realCount === 0 ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-3 py-2">{g.instituteName ?? "-"}</td>
                    <td className="px-3 py-2">{g.branchName ?? "-"}</td>
                    <td className="px-3 py-2">{g.totalCount}</td>
                    <td className="px-3 py-2">
                      {g.realCount === 0 ? (
                        <span className="text-amber-700">0</span>
                      ) : (
                        g.realCount
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            All Records ({total.toLocaleString("en-IN")})
          </h3>
          <div className="flex gap-2 text-xs">
            {(["all", "real", "mock"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSourceFilter(s);
                  setPage(1);
                }}
                className={`rounded-md border px-3 py-1.5 font-medium ${
                  sourceFilter === s
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {s === "all" ? "All" : s === "real" ? "Real only" : "Mock only"}
              </button>
            ))}
          </div>
        </div>

        {loadingTable ? (
          <p className="mt-3 text-sm text-slate-400">Loading records...</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Institute</th>
                    <th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Yr/Rd</th>
                    <th className="px-3 py-2">Quota</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Opening</th>
                    <th className="px-3 py-2">Closing</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Unavailable</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{r.instituteName ?? "-"}</td>
                      <td className="px-3 py-2">{r.branchName ?? "-"}</td>
                      <td className="px-3 py-2">{r.year}/{r.round}</td>
                      <td className="px-3 py-2">{r.quota}</td>
                      <td className="px-3 py-2">{r.category}</td>
                      <td className="px-3 py-2">{r.openingRank.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">{r.closingRank.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">
                        {r.dataVersion === "seed-v1" ? (
                          <span className="text-amber-700">mock</span>
                        ) : (
                          <span className="text-emerald-700">real</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleUnavailable(r.id, r.isUnavailable)}
                          disabled={togglingId === r.id}
                          className={`rounded-md border px-2 py-1 text-xs ${
                            r.isUnavailable
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-slate-300 bg-white text-slate-600"
                          }`}
                        >
                          {togglingId === r.id ? "..." : r.isUnavailable ? "Yes" : "No"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}