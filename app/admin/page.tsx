import { db, schema } from "@/db/client";
import { sql, eq, ne } from "drizzle-orm";

async function getStats() {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
  const [listCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.savedChoiceLists);
  const [cutoffTotal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cutoffRecords);
  const [cutoffReal] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cutoffRecords)
    .where(ne(schema.cutoffRecords.dataVersion, "seed-v1"));
  const [cutoffMock] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cutoffRecords)
    .where(eq(schema.cutoffRecords.dataVersion, "seed-v1"));
  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatSessions);
  const [instituteCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.institutes);

  return {
    users: userCount?.count ?? 0,
    savedLists: listCount?.count ?? 0,
    cutoffTotal: cutoffTotal?.count ?? 0,
    cutoffReal: cutoffReal?.count ?? 0,
    cutoffMock: cutoffMock?.count ?? 0,
    chatSessions: sessionCount?.count ?? 0,
    institutes: instituteCount?.count ?? 0,
  };
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone ?? "border-slate-200 bg-white"}`}>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getStats();
  const realPercentRaw =
    stats.cutoffTotal > 0 ? (stats.cutoffReal / stats.cutoffTotal) * 100 : 0;
  const realPercentLabel =
    realPercentRaw > 0 && realPercentRaw < 1 ? "<1%" : Math.round(realPercentRaw) + "%";

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
      <p className="mt-1 text-sm text-slate-500">
        Snapshot of users, saved lists, and cutoff data coverage.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Users" value={stats.users} />
        <StatCard label="Saved Choice Lists" value={stats.savedLists} />
        <StatCard label="Institutes Loaded" value={stats.institutes} />
        <StatCard label="Chat Sessions" value={stats.chatSessions} />
      </div>

      <h3 className="mt-8 text-sm font-semibold text-slate-800">Cutoff Data Coverage</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Cutoff Records" value={stats.cutoffTotal} />
        <StatCard
          label="Real (Official) Records"
          value={stats.cutoffReal}
          tone="border-emerald-200 bg-emerald-50"
        />
        <StatCard
          label="Seeded / Mock Records"
          value={stats.cutoffMock}
          tone="border-amber-200 bg-amber-50"
        />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {realPercentLabel} of cutoff records are backed by real official data. The rest are seeded
        placeholders used for development and demos.
      </p>
    </div>
  );
}