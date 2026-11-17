/**
 * Reports whether the database holds real or mock cutoff data.
 *
 *   npm run db:check                 -> read-only report
 *   npm run db:check -- --purge-mock -> delete the generated "seed-v1" mock cutoffs
 *                                       (refuses to run if no real data exists)
 *
 * Mock rows come from db/seed.ts (data_version = 'seed-v1',
 * source_document = 'SEED_MOCK_DATA'). They are made-up numbers and must never
 * be shown to students next to real JoSAA data.
 */
import { sql, eq, and, notExists } from "drizzle-orm";
import { db, schema } from "../db/client";

async function main() {
  const purge = process.argv.includes("--purge-mock");

  const byVersion = await db
    .select({
      dataVersion: schema.cutoffRecords.dataVersion,
      sourceDocument: schema.cutoffRecords.sourceDocument,
      rows: sql<number>`count(*)::int`,
      minYear: sql<number>`min(${schema.cutoffRecords.year})`,
      maxYear: sql<number>`max(${schema.cutoffRecords.year})`,
    })
    .from(schema.cutoffRecords)
    .groupBy(schema.cutoffRecords.dataVersion, schema.cutoffRecords.sourceDocument)
    .orderBy(schema.cutoffRecords.dataVersion);

  console.log("\n=== cutoff_records by data_version / source_document ===");
  if (byVersion.length === 0) console.log("(table is empty)");
  for (const r of byVersion) {
    const tag = r.dataVersion === "seed-v1" ? "  <-- MOCK" : "";
    console.log(
      `${String(r.rows).padStart(7)}  ${r.dataVersion}  ${r.sourceDocument ?? "(no source)"}  years ${r.minYear}-${r.maxYear}${tag}`
    );
  }

  const mock = byVersion.filter((r) => r.dataVersion === "seed-v1").reduce((a, r) => a + r.rows, 0);
  const real = byVersion.filter((r) => r.dataVersion !== "seed-v1").reduce((a, r) => a + r.rows, 0);
  console.log(`\nMock rows: ${mock}\nReal rows: ${real}`);

  if (mock === 0) {
    console.log("\nOK: no mock data present.");
    return;
  }
  if (!purge) {
    console.log(
      real > 0
        ? "\nMock data is mixed in with real data. Run again with --purge-mock to remove it."
        : "\nOnly mock data is present. Ingest real data first, then run with --purge-mock."
    );
    return;
  }
  if (real === 0) {
    console.error("\nRefusing to purge: there is no real data, the app would be left empty.");
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(schema.cutoffRecords)
      .where(eq(schema.cutoffRecords.dataVersion, "seed-v1"))
      .returning({ id: schema.cutoffRecords.id });

    // Remove branches / institutes that only existed because of the seed.
    const orphanBranches = await tx
      .delete(schema.branches)
      .where(
        notExists(
          tx
            .select({ one: sql`1` })
            .from(schema.cutoffRecords)
            .where(eq(schema.cutoffRecords.branchId, schema.branches.id))
        )
      )
      .returning({ id: schema.branches.id });

    const orphanInstitutes = await tx
      .delete(schema.institutes)
      .where(
        and(
          notExists(
            tx
              .select({ one: sql`1` })
              .from(schema.branches)
              .where(eq(schema.branches.instituteId, schema.institutes.id))
          ),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(schema.cutoffRecords)
              .where(eq(schema.cutoffRecords.instituteId, schema.institutes.id))
          )
        )
      )
      .returning({ id: schema.institutes.id });

    console.log(
      `\nPurged ${deleted.length} mock cutoffs, ${orphanBranches.length} orphan branches, ${orphanInstitutes.length} orphan institutes.`
    );
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
