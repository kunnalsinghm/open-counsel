"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("AuthStatus: failed to check login state:", err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="text-sm text-slate-600 hover:text-brand-700">
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/my-lists" className="text-slate-600 hover:text-brand-700">
        My Lists
      </Link>
      <span className="hidden text-slate-400 sm:inline">{user.email}</span>
      <button onClick={handleSignOut} className="text-slate-600 hover:text-brand-700">
        Log out
      </button>
    </div>
  );
}