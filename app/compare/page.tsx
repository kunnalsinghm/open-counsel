"use client";

import { useEffect, useState } from "react";
import { X, Search, AlertTriangle } from "lucide-react";

interface Institute {
  id: string;
  name: string;
  instituteType: string;
  state: string;
  nirfRank: number | null;
  website: string | null;
}

interface CutoffRow {
  institute: string;
  branch: string;
  year: number;
  round: number;
  quota: string;
  category: string;
  openingRank: number;
  closingRank: number;
  source: string;
}

const QUOTAS = ["OS", "HS", "AI", "GO", "JK", "LA"];
const CATEGORIES = ["OPEN", "EWS", "OBC-NCL", "SC", "ST", "PwD"];
const MAX_COMPARE = 4;

function latestRow(rows: CutoffRow[]): CutoffRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, r) => {
    if (r.year !== best.year) return r.year > best.year ? r : best;
    return r.round > best.round ? r : best;
  });
}

export default function ComparePage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Institute[]>([]);
  const [selected, setSelected] = useState<Institute[]>([]);
  const [branch, setBranch] = useState("CSE");
  const [quota, setQuota] = useState("OS");
  const [category, setCategory] = useState("OPEN");
  const [cutoffsByInstitute, setCutoffsByInstitute] = useState<Record<string, CutoffRow[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/institutes?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(
          (data.institutes ?? []).filter(
            (i: Institute) => !selected.some((s) => s.id === i.id)
          )
        );
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  function addInstitute(inst: Institute) {
    if (selected.length >= MAX_COMPARE) return;
    setSelected((prev) => [...prev, inst]);
    setQuery("");
    setSuggestions([]);
  }

  function removeInstitute(id: string) {
    setSelected((prev) => prev.filter((i) => i.id !== id));
    setCutoffsByInstitute((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  useEffect(() => {
    if (selected.length === 0) {
      setCutoffsByInstitute({});
      return;
    }
    setLoading(true);
    Promise.all(
      selected.map(async (inst) => {
        const params = new URLSearchParams({
          institute: inst.name,
          branch,
          quota,
          category,
        });
        const res = await fetch(`/api/cutoffs?${params.toString()}`);
        const data = await res.json();
        return [inst.id, Array.isArray(data.result) ? (data.result as CutoffRow[]) : []] as const;
      })
    ).then((entries) => {
      setCutoffsByInstitute(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [selected, branch, quota, category]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Compare Colleges</h1>
      <p className="mt-2 text-sm text-slate-500">
        Compare up to {MAX_COMPARE} institutes side by side for a given branch, quota, and
        category. Data shown is the most recent year/round available for each institute under
        these filters.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Branch code</label>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value.toUpperCase())}
            placeholder="e.g. CSE"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Quota</label>
          <select
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {QUOTAS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              selected.length >= MAX_COMPARE
                ? `Maximum ${MAX_COMPARE} institutes reached`
                : "Search for an institute to add (e.g. NIT Calicut)"
            }
            disabled={selected.length >= MAX_COMPARE}
            className="w-full text-sm outline-none disabled:bg-transparent disabled:text-slate-400"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((inst) => (
              <button
                key={inst.id}
                onClick={() => addInstitute(inst)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span>{inst.name}</span>
                <span className="text-xs text-slate-400">
                  {inst.instituteType} · {inst.state}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          Add institutes above to start comparing.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-40 border-b border-slate-200 py-2 text-left text-xs font-medium text-slate-500">
                  Institute
                </th>
                {selected.map((inst) => (
                  <th key={inst.id} className="border-b border-slate-200 px-4 py-2 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">{inst.name}</span>
                      <button
                        onClick={() => removeInstitute(inst.id)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label={`Remove ${inst.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">Type</td>
                {selected.map((inst) => (
                  <td key={inst.id} className="px-4 py-2">{inst.instituteType}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">State</td>
                {selected.map((inst) => (
                  <td key={inst.id} className="px-4 py-2">{inst.state}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">NIRF Rank</td>
                {selected.map((inst) => (
                  <td key={inst.id} className="px-4 py-2">{inst.nirfRank ?? "—"}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">Latest Closing Rank</td>
                {selected.map((inst) => {
                  const row = latestRow(cutoffsByInstitute[inst.id] ?? []);
                  return (
                    <td key={inst.id} className="px-4 py-2 font-semibold text-slate-900">
                      {loading ? "…" : row ? row.closingRank.toLocaleString() : "No data"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">Latest Opening Rank</td>
                {selected.map((inst) => {
                  const row = latestRow(cutoffsByInstitute[inst.id] ?? []);
                  return (
                    <td key={inst.id} className="px-4 py-2">
                      {loading ? "…" : row ? row.openingRank.toLocaleString() : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">Year / Round</td>
                {selected.map((inst) => {
                  const row = latestRow(cutoffsByInstitute[inst.id] ?? []);
                  return (
                    <td key={inst.id} className="px-4 py-2 text-slate-600">
                      {row ? `${row.year} · Round ${row.round}` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2 text-xs font-medium text-slate-500">Data Source</td>
                {selected.map((inst) => {
                  const row = latestRow(cutoffsByInstitute[inst.id] ?? []);
                  const isMock = row?.source === "SEED_MOCK_DATA";
                  return (
                    <td key={inst.id} className="px-4 py-2">
                      {row ? (
                        <span
                          className={
                            isMock
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                              : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                          }
                        >
                          {isMock ? "Seeded / mock" : "Real"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-md bg-slate-100 p-3 text-xs text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        Cutoff ranks vary by year, round, quota, category, and seat pool. Always verify against
        the latest official notification before making a decision.
      </p>
    </div>
  );
}