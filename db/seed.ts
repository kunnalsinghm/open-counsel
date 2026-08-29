import { db, schema } from "./client";
import { eq } from "drizzle-orm";

const BRANCHES = [
  { name: "Computer Science and Engineering", code: "CSE", difficulty: 1.0 },
  { name: "Electronics and Communication Engineering", code: "ECE", difficulty: 1.4 },
  { name: "Electrical Engineering", code: "EE", difficulty: 1.7 },
  { name: "Mechanical Engineering", code: "ME", difficulty: 2.3 },
  { name: "Civil Engineering", code: "CE", difficulty: 3.2 },
];

const INSTITUTES: [string, string, string, number, number][] = [
  ["IIT Bombay", "IIT", "Maharashtra", 1, 3],
  ["IIT Delhi", "IIT", "Delhi", 1.05, 2],
  ["IIT Madras", "IIT", "Tamil Nadu", 1.1, 1],
  ["IIT Kanpur", "IIT", "Uttar Pradesh", 1.15, 4],
  ["IIT Kharagpur", "IIT", "West Bengal", 1.2, 5],
  ["IIT Roorkee", "IIT", "Uttarakhand", 1.3, 6],
  ["IIT Guwahati", "IIT", "Assam", 1.4, 7],
  ["IIT Hyderabad", "IIT", "Telangana", 1.5, 8],
  ["NIT Tiruchirappalli", "NIT", "Tamil Nadu", 3.0, 9],
  ["NIT Surathkal", "NIT", "Karnataka", 3.1, 13],
  ["NIT Rourkela", "NIT", "Odisha", 3.3, 16],
  ["NIT Warangal", "NIT", "Telangana", 3.2, 19],
  ["NIT Calicut", "NIT", "Kerala", 3.5, 23],
  ["NIT Durgapur", "NIT", "West Bengal", 4.2, 47],
  ["VNIT Nagpur", "NIT", "Maharashtra", 3.8, 41],
  ["NIT Allahabad (MNNIT)", "NIT", "Uttar Pradesh", 3.9, 45],
  ["IIIT Hyderabad", "IIIT", "Telangana", 1.8, 11],
  ["IIIT Bangalore", "IIIT", "Karnataka", 2.0, 33],
  ["IIIT Delhi", "IIIT", "Delhi", 2.1, 22],
  ["IIIT Allahabad", "IIIT", "Uttar Pradesh", 3.6, 51],
];

const YEARS = [2023, 2024];
const ROUNDS = [1, 2, 3, 4, 5, 6];
const QUOTAS = ["HS", "OS", "AI"] as const;
const CATEGORY = "OPEN";
const SEAT_POOL = "Gender-Neutral";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function main() {
  console.log("Seeding OpenCounsel database (Postgres)...");

  let [exam] = await db
    .select()
    .from(schema.examSystems)
    .where(eq(schema.examSystems.code, "JOSAA"))
    .limit(1);

  if (!exam) {
    [exam] = await db
      .insert(schema.examSystems)
      .values({
        code: "JOSAA",
        name: "Joint Seat Allocation Authority",
        description: "Central counseling for IITs, NITs, IIITs and GFTIs.",
        categories: ["OPEN", "EWS", "OBC-NCL", "SC", "ST", "PwD"],
        quotas: ["HS", "OS", "AI", "GO"],
      })
      .returning();
  }

  const existingRules = await db
    .select()
    .from(schema.counselingRules)
    .where(eq(schema.counselingRules.examSystemId, exam.id));

  if (existingRules.length === 0) {
    await db.insert(schema.counselingRules).values([
      {
        examSystemId: exam.id,
        topic: "FREEZE",
        title: "What does Freeze mean?",
        body: "Freezing your allotted seat means you accept it and exit the counseling process — you will not be considered in later rounds and must complete admission formalities at the allotted institute.",
        officialUrl: "https://josaa.nic.in",
      },
      {
        examSystemId: exam.id,
        topic: "FLOAT",
        title: "What does Float mean?",
        body: "Floating means you accept your current seat but remain open to a better allotment in a later round based on your remaining choices. You keep your current seat as a backup if no better option comes.",
        officialUrl: "https://josaa.nic.in",
      },
      {
        examSystemId: exam.id,
        topic: "SLIDE",
        title: "What does Slide mean?",
        body: "Sliding means you accept your current seat but want to be considered only for a better branch within the SAME institute in later rounds, not other institutes.",
        officialUrl: "https://josaa.nic.in",
      },
      {
        examSystemId: exam.id,
        topic: "WITHDRAWAL",
        title: "Seat withdrawal",
        body: "You may withdraw from the counseling process before the official withdrawal deadline for a partial refund, subject to official rules published for that year.",
        officialUrl: "https://josaa.nic.in",
      },
      {
        examSystemId: exam.id,
        topic: "REFUND",
        title: "Refund policy",
        body: "Refund amounts and deadlines are set by the counseling authority each year and are published on the official portal — always check the current year's notification.",
        officialUrl: "https://josaa.nic.in",
      },
    ]);
  }

  const existingInstitutes = await db
    .select()
    .from(schema.institutes)
    .where(eq(schema.institutes.examSystemId, exam.id));

  if (existingInstitutes.length > 0) {
    console.log("Institutes already seeded — skipping cutoff generation.");
    process.exit(0);
  }

  const rng = seededRandom(42);
  let cutoffCount = 0;

  for (const [name, type, state, baseFactor, nirfRank] of INSTITUTES) {
    const [institute] = await db
      .insert(schema.institutes)
      .values({
        examSystemId: exam.id,
        name,
        instituteType: type,
        state,
        nirfRank,
        website: `https://www.${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.ac.in`,
      })
      .returning();

    for (const branch of BRANCHES) {
      const [branchRow] = await db
        .insert(schema.branches)
        .values({ instituteId: institute.id, name: branch.name, shortCode: branch.code })
        .returning();

      const baseClosing = Math.round(1800 * baseFactor * branch.difficulty);
      const insertBatch: (typeof schema.cutoffRecords.$inferInsert)[] = [];

      for (const year of YEARS) {
        const yearFactor = year === 2024 ? 0.96 : 1.0;

        for (const quota of QUOTAS) {
          const quotaFactor = quota === "AI" ? 1.0 : quota === "HS" ? 0.75 : 0.85;
          let prevClosing = 0;

          for (const round of ROUNDS) {
            const roundLooseningFactor = 1 + (round - 1) * 0.03;
            const noise = 0.95 + rng() * 0.1;

            const closingRank = Math.max(
              5,
              Math.round(baseClosing * yearFactor * quotaFactor * roundLooseningFactor * noise)
            );
            const openingRank = Math.max(1, Math.round(closingRank * (0.55 + rng() * 0.2)));
            const finalClosing = Math.max(closingRank, prevClosing);
            prevClosing = finalClosing;

            insertBatch.push({
              examSystemId: exam.id,
              instituteId: institute.id,
              branchId: branchRow.id,
              year,
              round,
              quota,
              seatPool: SEAT_POOL,
              category: CATEGORY,
              openingRank,
              closingRank: finalClosing,
              sourceDocument: "SEED_MOCK_DATA",
              dataVersion: "seed-v1",
            });
            cutoffCount++;
          }
        }
      }

      await db.insert(schema.cutoffRecords).values(insertBatch);
    }
  }

  console.log(`Seeded ${INSTITUTES.length} institutes, ${BRANCHES.length} branches each.`);
  console.log(`Seeded ${cutoffCount} cutoff records.`);
  console.log(
    "NOTE: cutoff figures are illustrative mock data for development/demo use only — NOT verified official JoSAA data. Replace via the admin data-ingestion pipeline before any real launch."
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});