import {
  PAYMENTS_ENABLED,
  PRICE_PAISE,
  DONATION_PRESETS_PAISE,
  AI_DAILY_QUESTION_LIMIT_FREE,
  AI_DAILY_QUESTION_LIMIT_PAID,
  MIN_RECOMMENDED_CHOICES,
  MIN_RECOMMENDED_SAFE_CHOICES,
  CLASSIFICATION_THRESHOLDS,
  APP_MODE,
} from "@/lib/config";

function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function AdminPricingPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Pricing & Config</h2>
      <p className="mt-1 text-sm text-slate-500">
        Read-only view of current runtime configuration from lib/config.ts. Editing here is not
        yet supported - change the source file and redeploy to update these values.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Payments</h3>
        <div className="mt-2">
          <ConfigRow label="App Mode" value={APP_MODE} />
          <ConfigRow label="Payments Enabled" value={PAYMENTS_ENABLED ? "true" : "false"} />
          <ConfigRow label="Report Price" value={`Rs. ${PRICE_PAISE / 100}`} />
          <ConfigRow
            label="Donation Presets"
            value={DONATION_PRESETS_PAISE.map((p) => `Rs. ${p / 100}`).join(", ")}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">AI Chat Limits</h3>
        <div className="mt-2">
          <ConfigRow label="Free Tier Daily Questions" value={AI_DAILY_QUESTION_LIMIT_FREE} />
          <ConfigRow label="Paid Tier Daily Questions" value={AI_DAILY_QUESTION_LIMIT_PAID} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Choice List Recommendations</h3>
        <div className="mt-2">
          <ConfigRow label="Min Recommended Total Choices" value={MIN_RECOMMENDED_CHOICES} />
          <ConfigRow label="Min Recommended Safe Choices" value={MIN_RECOMMENDED_SAFE_CHOICES} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Risk Band Thresholds (rank gap %)</h3>
        <div className="mt-2">
          <ConfigRow
            label="Dream Range"
            value={`${CLASSIFICATION_THRESHOLDS.DREAM_MIN_GAP_PERCENT} to ${CLASSIFICATION_THRESHOLDS.DREAM_MAX_GAP_PERCENT}`}
          />
          <ConfigRow
            label="Target Range"
            value={`${CLASSIFICATION_THRESHOLDS.TARGET_MIN_GAP_PERCENT} to ${CLASSIFICATION_THRESHOLDS.TARGET_MAX_GAP_PERCENT}`}
          />
          <ConfigRow
            label="Safe Minimum"
            value={`${CLASSIFICATION_THRESHOLDS.SAFE_MIN_GAP_PERCENT}+`}
          />
        </div>
      </div>
    </div>
  );
}