import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

/**
 * Makes sure a row exists in our own `users` table for a Supabase Auth user.
 *
 * Supabase keeps its users in its own auth schema; our tables (chat_sessions,
 * saved_choice_lists, ...) reference `users.id`, so a row must exist before
 * anything that references it is inserted. Previously this only happened in
 * /api/save-list, which made /api/chat fail with a foreign-key error for anyone
 * who had not saved a list yet.
 *
 * If the user's email matches ADMIN_EMAIL (case-insensitive) they are marked as
 * an admin, so there is no need to edit the database by hand.
 */
export async function ensureUser(authUser: { id: string; email?: string | null }) {
  const email = authUser.email ?? null;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const shouldBeAdmin = !!adminEmail && !!email && email.toLowerCase() === adminEmail;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, authUser.id))
    .limit(1);

  if (!existing) {
    await db
      .insert(schema.users)
      .values({ id: authUser.id, email, isAdmin: shouldBeAdmin })
      .onConflictDoNothing();
    return;
  }

  if (shouldBeAdmin && !existing.isAdmin) {
    await db
      .update(schema.users)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(schema.users.id, authUser.id));
  }
}
