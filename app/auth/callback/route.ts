import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/ensure-user";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawRedirect = searchParams.get("redirect") ?? "/";
  // Only allow same-site relative redirects (prevents open-redirect abuse).
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await ensureUser(user);
    } catch (err) {
      // Never block login if our own DB is briefly unavailable; the user row is
      // also ensured lazily in /api/chat and /api/save-list.
      console.error("ensureUser failed in auth callback:", err);
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
