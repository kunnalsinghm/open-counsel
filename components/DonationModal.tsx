"use client";

import { useState } from "react";
import { X, Heart } from "lucide-react";
import { DONATION_PRESETS_PAISE } from "@/lib/config";

export default function DonationModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  const amountPaise = custom ? Math.round(Number(custom) * 100) : selected ?? 0;

  async function handleDonate() {
    if (!amountPaise) return;
    setStatus("submitting");
    // Dev-mode mock: in production this calls the PaymentProvider
    // abstraction (create_order -> redirect to Razorpay/Cashfree checkout).
    await new Promise((r) => setTimeout(r, 600));
    setStatus("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">Support OpenCounsel</h3>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {status === "done" ? (
          <div className="py-6 text-center">
            <p className="text-lg font-semibold text-emerald-600">Thank you! 🙏</p>
            <p className="mt-1 text-sm text-slate-600">
              Your support helps keep OpenCounsel free for every student.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              This platform is 100% free and open to all students. If it helped you save
              agent fees, consider supporting server costs — completely optional.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DONATION_PRESETS_PAISE.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelected(p);
                    setCustom("");
                  }}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                    selected === p && !custom
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  ₹{p / 100}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Custom amount (₹)"
              className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelected(null);
              }}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                No thanks
              </button>
              <button
                onClick={handleDonate}
                disabled={!amountPaise || status === "submitting"}
                className="flex-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {status === "submitting" ? "Processing…" : "Donate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
