import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/ensure-user";

export interface AdminUser {
  id: string;
  email: string | null;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Creates the users row and promotes ADMIN_EMAIL to admin if needed.
  await ensureUser(user);

  const [dbUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!dbUser || !dbUser.isAdmin) return null;

  return { id: user.id, email: user.email ?? null };
}

export async function requireAdminApi(): Promise<
  { ok: true; user: AdminUser } | { ok: false; response: NextResponse }
> {
  const admin = await getAdminUser();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden: admin access required." }, { status: 403 }),
    };
  }
  return { ok: true, user: admin };
}