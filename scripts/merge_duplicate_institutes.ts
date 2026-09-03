/**
 * merge_duplicate_institutes.ts
 *
 * Merges "old mock" institute rows into their real-data counterparts.
 *
 * IMPORTANT: cutoff_records has a unique constraint on
 * (exam_system_id, institute_id, branch_id, year, round, quota, seat_pool, category).
 * The old mock data and the real imported data cover the same (year, round, quota,
 * seat_pool, category) combinations, so blindly reassigning old records onto the
 * new institute/branch collides with real records that already occupy that slot.
 *
 * For each old cutoffRecord being merged:
 *   - If a real record already exists at (newInstituteId, newBranchId) with the same
 *     (examSystemId, year, round, quota, seatPool, category) -> DELETE the old record
 *     (the real one wins, the old mock one is redundant).
 *   - Otherwise -> UPDATE the old record's instituteId/branchId to the new values
 *     (preserves any combo the real import doesn't cover).
 *
 * Run with: npx tsx scripts/merge_duplicate_institutes.ts --dry-run
 * Then:     npx tsx scripts/merge_duplicate_institutes.ts --commit
 */

import { db, schema } from "@/db/client";
import { eq, and } from "drizzle-orm";

const INSTITUTE_MERGE_PAIRS: { oldName: string; newName: string }[] = [
  { oldName: "IIT Bombay", newName: "Indian Institute of Technology Bombay" },
  { oldName: "IIT Delhi", newName: "Indian Institute of Technology Delhi" },
  { oldName: "IIT Guwahati", newName: "Indian Institute of Technology Guwahati" },
  { oldName: "IIT Hyderabad", newName: "Indian Institute of Technology Hyderabad" },
  { oldName: "IIT Kanpur", newName: "Indian Institute of Technology Kanpur" },
  { oldName: "IIT Kharagpur", newName: "Indian Institute of Technology Kharagpur" },
  { oldName: "IIT Madras", newName: "Indian Institute of Technology Madras" },
  { oldName: "IIT Roorkee", newName: "Indian Institute of Technology Roorkee" },
  { oldName: "NIT Allahabad (MNNIT)", newName: "Motilal Nehru National Institute of Technology Allahabad" },
  { oldName: "NIT Calicut", newName: "National Institute of Technology Calicut" },
  { oldName: "NIT Durgapur", newName: "National Institute of Technology Durgapur" },
  { oldName: "NIT Rourkela", newName: "National Institute of Technology, Rourkela" },
  { oldName: "NIT Surathkal", newName: "National Institute of Technology Karnataka, Surathkal" },
  { oldName: "NIT Tiruchirappalli", newName: "National Institute of Technology, Tiruchirappalli" },
  { oldName: "NIT Trichy", newName: "National Institute of Technology, Tiruchirappalli" },
  { oldName: "NIT Warangal", newName: "National Institute of Technology, Warangal" },
  { oldName: "VNIT Nagpur", newName: "Visvesvaraya National Institute of Technology, Nagpur" },
  { oldName: "IIIT Allahabad", newName: "Indian Institute of Information Technology, Allahabad" },
];

const NO_MATCH_INSTITUTES = ["IIIT Bangalore", "IIIT Delhi", "IIIT Hyderabad"];

const STOPWORDS = new Set(["and", "of", "in", "with", "the", "for", "a"]);
const MIN_SIMILARITY = 0.6;
const DUAL_DEGREE_PATTERN = /5\s*Years|Dual Degree/i;

function normalizeBranchName(name: string): string[] {
  let cleaned = name.replace(/\(\s*\d+\s*Years?,.*?\)\s*$/i, "");
  cleaned = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return cleaned.split(" ").filter((t) => t && !STOPWORDS.has(t));
}

function branchNameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeBranchName(a));
  const tb = new Set(normalizeBranchName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((t) => tb.has(t));
  return inter.length / Math.max(ta.size, tb.size);
}

type Branch = typeof schema.branches.$inferSelect;
type CutoffRecord = typeof schema.cutoffRecords.$inferSelect;

interface BranchMerge {
  oldBranchId: string;
  oldBranchName: string;
  newBranchId: string;
  newBranchName: string;
  similarity: number;
  resolvedTie: boolean;
}

interface MergePlanEntry {
  oldInstituteId: string;
  oldInstituteName: string;
  newInstituteId: string;
  newInstituteName: string;
  branchMerges: BranchMerge[];
  branchDeletes: { id: string; name: string; recordCount: number; reason: string }[];
  unmatchedOldBranches: { id: string; name: string; reason: string }[];
}

async function findInstituteByName(name: string) {
  const rows = await db.select().from(schema.institutes).where(eq(schema.institutes.name, name));
  return rows[0] ?? null;
}

async function findBranchesByInstitute(instituteId: string): Promise<Branch[]> {
  return db.select().from(schema.branches).where(eq(schema.branches.instituteId, instituteId));
}

async function findRecordsForBranch(instituteId: string, branchId: string): Promise<CutoffRecord[]> {
  return db
    .select()
    .from(schema.cutoffRecords)
    .where(and(eq(schema.cutoffRecords.instituteId, instituteId), eq(schema.cutoffRecords.branchId, branchId)));
}

async function recordExistsAt(
  examSystemId: string,
  instituteId: string,
  branchId: string,
  year: number,
  round: number,
  quota: string,
  seatPool: string,
  category: string
): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.cutoffRecords)
    .where(
      and(
        eq(schema.cutoffRecords.examSystemId, examSystemId),
        eq(schema.cutoffRecords.instituteId, instituteId),
        eq(schema.cutoffRecords.branchId, branchId),
        eq(schema.cutoffRecords.year, year),
        eq(schema.cutoffRecords.round, round),
        eq(schema.cutoffRecords.quota, quota),
        eq(schema.cutoffRecords.seatPool, seatPool),
        eq(schema.cutoffRecords.category, category)
      )
    );
  return rows.length > 0;
}

async function previewBranchMergeConflicts(
  oldInstituteId: string,
  bm: BranchMerge,
  newInstituteId: string
): Promise<{ toDelete: number; toReassign: number }> {
  const oldRecords = await findRecordsForBranch(oldInstituteId, bm.oldBranchId);
  let toDelete = 0;
  let toReassign = 0;
  for (const rec of oldRecords) {
    const exists = await recordExistsAt(
      rec.examSystemId,
      newInstituteId,
      bm.newBranchId,
      rec.year,
      rec.round,
      rec.quota,
      rec.seatPool,
      rec.category
    );
    if (exists) toDelete++;
    else toReassign++;
  }
  return { toDelete, toReassign };
}

async function buildMergePlan(): Promise<MergePlanEntry[]> {
  const plan: MergePlanEntry[] = [];

  for (const { oldName, newName } of INSTITUTE_MERGE_PAIRS) {
    const oldInst = await findInstituteByName(oldName);
    const newInst = await findInstituteByName(newName);

    if (!oldInst) {
      console.warn(`Old institute not found in DB, skipping: "${oldName}"`);
      continue;
    }
    if (!newInst) {
      console.warn(`New institute not found in DB, skipping: "${newName}"`);
      continue;
    }
    if (oldInst.id === newInst.id) continue;

    const oldBranches = await findBranchesByInstitute(oldInst.id);
    const newBranches = await findBranchesByInstitute(newInst.id);

    const branchMerges: BranchMerge[] = [];
    const branchDeletes: MergePlanEntry["branchDeletes"] = [];
    const unmatchedOldBranches: MergePlanEntry["unmatchedOldBranches"] = [];

    for (const ob of oldBranches) {
      const scored = newBranches
        .map((nb) => ({ branch: nb, score: branchNameSimilarity(ob.name, nb.name) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];

      if (!best || best.score < MIN_SIMILARITY) {
        const recs = await findRecordsForBranch(oldInst.id, ob.id);
        branchDeletes.push({
          id: ob.id,
          name: ob.name,
          recordCount: recs.length,
          reason: best
            ? `best score ${best.score.toFixed(2)} below threshold ${MIN_SIMILARITY} — no real counterpart`
            : "no candidate branches",
        });
        continue;
      }

      const tied = scored.filter((s) => s.score === best.score);
      if (tied.length > 1) {
        const dualCandidates = tied.filter((t) => DUAL_DEGREE_PATTERN.test(t.branch.name));
        if (dualCandidates.length === 1) {
          const winner = dualCandidates[0];
          branchMerges.push({
            oldBranchId: ob.id,
            oldBranchName: ob.name,
            newBranchId: winner.branch.id,
            newBranchName: winner.branch.name,
            similarity: Math.round(winner.score * 1000) / 1000,
            resolvedTie: true,
          });
        } else {
          unmatchedOldBranches.push({
            id: ob.id,
            name: ob.name,
            reason: `ambiguous tie at score ${best.score.toFixed(2)} among ${tied.length} candidates`,
          });
        }
        continue;
      }

      branchMerges.push({
        oldBranchId: ob.id,
        oldBranchName: ob.name,
        newBranchId: best.branch.id,
        newBranchName: best.branch.name,
        similarity: Math.round(best.score * 1000) / 1000,
        resolvedTie: false,
      });
    }

    plan.push({
      oldInstituteId: oldInst.id,
      oldInstituteName: oldInst.name,
      newInstituteId: newInst.id,
      newInstituteName: newInst.name,
      branchMerges,
      branchDeletes,
      unmatchedOldBranches,
    });
  }

  return plan;
}

async function printPlan(plan: MergePlanEntry[]) {
  console.log("\n=== MERGE PLAN ===\n");
  let totalToDelete = 0;
  let totalToReassign = 0;

  for (const entry of plan) {
    console.log(entry.oldInstituteName + "  ->  " + entry.newInstituteName);
    console.log("  Branch matches:");
    for (const bm of entry.branchMerges) {
      const tieNote = bm.resolvedTie ? "  [tie resolved -> dual-degree variant]" : "";
      const conflicts = await previewBranchMergeConflicts(entry.oldInstituteId, bm, entry.newInstituteId);
      totalToDelete += conflicts.toDelete;
      totalToReassign += conflicts.toReassign;
      console.log(
        '    "' + bm.oldBranchName + '" -> "' + bm.newBranchName + '"  (score ' + bm.similarity + ")" + tieNote
      );
      console.log(
        "        -> " + conflicts.toReassign + " record(s) reassigned, " +
        conflicts.toDelete + " record(s) deleted as duplicates of existing real data"
      );
    }
    if (entry.branchDeletes.length) {
      console.log("  Branches to DELETE (no real counterpart, records deleted too):");
      for (const bd of entry.branchDeletes) {
        console.log('    - "' + bd.name + '" (' + bd.recordCount + " records) — " + bd.reason);
      }
    }
    if (entry.unmatchedOldBranches.length) {
      console.log("  STILL UNMATCHED (blocks commit):");
      for (const ub of entry.unmatchedOldBranches) {
        console.log('    - "' + ub.name + '" (id: ' + ub.id + ") — " + ub.reason);
      }
    }
    console.log("");
  }

  console.log(`Totals across all branch merges: ${totalToReassign} record(s) will be reassigned, ${totalToDelete} record(s) will be deleted as duplicates.\n`);
  console.log("Institutes without a real-data match (left untouched): " + NO_MATCH_INSTITUTES.join(", ") + "\n");
}

async function commitPlan(plan: MergePlanEntry[]) {
  await db.transaction(async (tx) => {
    for (const entry of plan) {
      if (entry.unmatchedOldBranches.length > 0) {
        throw new Error(
          'Refusing to commit: "' + entry.oldInstituteName + '" has ' +
          entry.unmatchedOldBranches.length + " unmatched branch(es). Resolve manually first."
        );
      }

      for (const bm of entry.branchMerges) {
        const oldRecords = await tx
          .select()
          .from(schema.cutoffRecords)
          .where(
            and(
              eq(schema.cutoffRecords.instituteId, entry.oldInstituteId),
              eq(schema.cutoffRecords.branchId, bm.oldBranchId)
            )
          );

        let deleted = 0;
        let reassigned = 0;

        for (const rec of oldRecords) {
          const existing = await tx
            .select()
            .from(schema.cutoffRecords)
            .where(
              and(
                eq(schema.cutoffRecords.examSystemId, rec.examSystemId),
                eq(schema.cutoffRecords.instituteId, entry.newInstituteId),
                eq(schema.cutoffRecords.branchId, bm.newBranchId),
                eq(schema.cutoffRecords.year, rec.year),
                eq(schema.cutoffRecords.round, rec.round),
                eq(schema.cutoffRecords.quota, rec.quota),
                eq(schema.cutoffRecords.seatPool, rec.seatPool),
                eq(schema.cutoffRecords.category, rec.category)
              )
            );

          if (existing.length > 0) {
            await tx.delete(schema.cutoffRecords).where(eq(schema.cutoffRecords.id, rec.id));
            deleted++;
          } else {
            await tx
              .update(schema.cutoffRecords)
              .set({ instituteId: entry.newInstituteId, branchId: bm.newBranchId })
              .where(eq(schema.cutoffRecords.id, rec.id));
            reassigned++;
          }
        }

        await tx.delete(schema.branches).where(eq(schema.branches.id, bm.oldBranchId));
        console.log(
          '  "' + bm.oldBranchName + '" -> "' + bm.newBranchName + '": ' +
          reassigned + " reassigned, " + deleted + " deleted as duplicates"
        );
      }

      for (const bd of entry.branchDeletes) {
        await tx
          .delete(schema.cutoffRecords)
          .where(
            and(
              eq(schema.cutoffRecords.instituteId, entry.oldInstituteId),
              eq(schema.cutoffRecords.branchId, bd.id)
            )
          );
        await tx.delete(schema.branches).where(eq(schema.branches.id, bd.id));
      }

      await tx.delete(schema.institutes).where(eq(schema.institutes.id, entry.oldInstituteId));

      console.log('Merged "' + entry.oldInstituteName + '" into "' + entry.newInstituteName + '"\n');
    }
  });
}

async function main() {
  const commit = process.argv.includes("--commit");
  const plan = await buildMergePlan();
  await printPlan(plan);

  const hasBlockers = plan.some((e) => e.unmatchedOldBranches.length > 0);
  if (hasBlockers) {
    console.log("Some institutes still have unmatched branches. Fix manually before running --commit.\n");
    if (commit) process.exit(1);
    return;
  }

  if (!commit) {
    console.log("Dry run only — nothing was changed. Re-run with --commit to apply.\n");
    return;
  }

  console.log("Committing merge in a single transaction...\n");
  await commitPlan(plan);
  console.log("All merges committed successfully.");
}

main()
  .catch((err) => {
    console.error("Merge failed, transaction rolled back:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
