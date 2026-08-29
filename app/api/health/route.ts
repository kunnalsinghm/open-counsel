import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export async function GET() {
  let database = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    database = "error";
  }
  return NextResponse.json({
    status: database === "ok" ? "ok" : "degraded",
    database,
    version: process.env.npm_package_version ?? "0.1.0",
  });
}