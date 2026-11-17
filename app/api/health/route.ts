import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

// Must run on every request. Without this Next prerenders the route at build
// time and the reported database status is frozen forever.
export const dynamic = "force-dynamic";

export async function GET() {
  let database = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "error";
  }
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
