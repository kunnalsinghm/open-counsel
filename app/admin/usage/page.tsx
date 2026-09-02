"use client";

import { useEffect, useState } from "react";

interface DayCount {
  day: string;
  count: number;
}

interface UsageData {
  signupsByDay: DayCount[];
  listsByDay: DayCount[];
  chatStats: {
    totalSessions: number;
    totalMessages: number;
    totalCostPaise: number;
  };
  totalProfilesCreated: number;
}

function MiniBarChart({ data, label }: { data: DayCount[]; label: string }) {
  if (data.length === 0) {
    return <p className="mt-2 text-sm text-slate-400">No {label.toLowerCase()} yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="mt-3 flex items-end gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
      {data.map((d) => (
        <div key={d.day} className="flex flex-col items-center gap-1" title={`${d.day}: ${d.count}`}>
          <div
            className="w-6 rounded-t bg-brand-500"
            style={{ height: `${Math.max(4, (d.count / max) * 80)}px` }}
          />
          <span className="rotate-45 text-[9px] text-slate-400">{d.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading usage data...</p>;
  if (!data) return <p className="text-sm text-red-600">Could not load usage data.</p>;

  const totalSignups = data.signupsByDay.reduce((sum, d) => sum + d.count, 0);
  const totalLists = data.listsByDay.reduce((sum, d) => sum + d.count, 0);
  const costRupees = (data.chatStats.totalCostPaise / 100).toFixed(2);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Usage</h2>
      <p className="mt-1 text-sm text-slate-500">Signups, saved lists, and AI chat volume.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Signups" value={totalSignups} />
        <StatCard label="Profiles Created" value={data.totalProfilesCreated} />
        <StatCard label="Saved Lists" value={totalLists} />
        <StatCard label="Chat Sessions" value={data.chatStats.totalSessions} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Chat Messages" value={data.chatStats.totalMessages} />
        <StatCard label="Est. AI Cost" value={`Rs. ${costRupees}`} />
      </div>

      <h3 className="mt-8 text-sm font-semibold text-slate-800">Signups by Day</h3>
      <MiniBarChart data={data.signupsByDay} label="Signups" />

      <h3 className="mt-8 text-sm font-semibold text-slate-800">Saved Lists by Day</h3>
      <MiniBarChart data={data.listsByDay} label="Saved lists" />
    </div>
  );
}