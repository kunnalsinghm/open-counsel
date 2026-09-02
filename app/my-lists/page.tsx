"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SavedList {
  id: string;
  createdAt: string;
  itemCount: number;
  items: any[];
  profile: any;
}

export default function MyListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<SavedList[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login?redirect=/my-lists");
        return;
      }

      const res = await fetch("/api/my-lists");
      if (!res.ok) {
        setError("Could not load your saved lists.");
        return;
      }
      const data = await res.json();
      setLists(data.lists);
    }
    load();
  }, [router]);

  function openList(list: SavedList) {
    sessionStorage.setItem("opencounsel:profile", JSON.stringify(list.profile));
    sessionStorage.setItem(
      "opencounsel:results",
      JSON.stringify({
        items: list.items,
        lintIssues: [],
      })
    );
    router.push("/results");
  }

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-10 text-red-600">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Saved Lists</h1>

      {lists === null && <p className="mt-4 text-sm text-slate-500">Loading…</p>}

      {lists?.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          You haven't saved any choice lists yet. Build one and click "Save my list" on the
          results page.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {lists?.map((list) => (
          <button
            key={list.id}
            onClick={() => openList(list)}
            className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-brand-300 hover:bg-brand-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {list.profile.examSystemCode} — Rank{" "}
                {(list.profile.categoryRank ?? list.profile.crlRank)?.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(list.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {list.profile.category} · {list.profile.quota} · {list.itemCount} choices
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}