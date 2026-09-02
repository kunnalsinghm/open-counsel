import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireAdminApi } from "@/lib/admin-guard";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const signupsByDay = await db
    .select({
      day: sql<string>`to_char(${schema.users.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.users)
    .groupBy(sql`to_char(${schema.users.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.users.createdAt}, 'YYYY-MM-DD')`);

  const listsByDay = await db
    .select({
      day: sql<string>`to_char(${schema.savedChoiceLists.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.savedChoiceLists)
    .groupBy(sql`to_char(${schema.savedChoiceLists.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.savedChoiceLists.createdAt}, 'YYYY-MM-DD')`);

  const [chatStats] = await db
    .select({
      totalSessions: sql<number>`count(distinct ${schema.chatMessages.sessionId})::int`,
      totalMessages: sql<number>`count(*)::int`,
      totalCostPaise: sql<number>`coalesce(sum(${schema.chatMessages.estimatedCostPaise}), 0)::int`,
    })
    .from(schema.chatMessages);

  const [profileStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.studentProfiles);

  return NextResponse.json({
    signupsByDay,
    listsByDay,
    chatStats: {
      totalSessions: chatStats?.totalSessions ?? 0,
      totalMessages: chatStats?.totalMessages ?? 0,
      totalCostPaise: chatStats?.totalCostPaise ?? 0,
    },
    totalProfilesCreated: profileStats?.count ?? 0,
  });
}