import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-guard";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/login?redirect=/admin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-sm font-semibold text-slate-800">OpenCounsel Admin</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="text-slate-600 hover:text-brand-600">Overview</Link>
            <Link href="/admin/data" className="text-slate-600 hover:text-brand-600">Data</Link>
            <Link href="/admin/usage" className="text-slate-600 hover:text-brand-600">Usage</Link>
            <Link href="/admin/pricing" className="text-slate-600 hover:text-brand-600">Pricing</Link>
            <Link href="/admin/rules" className="text-slate-600 hover:text-brand-600">Rules</Link>
            <Link href="/" className="text-slate-400 hover:text-slate-600">Exit</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}