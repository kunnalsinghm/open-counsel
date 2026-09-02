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