export function routeIntent(message: string): "CUTOFF" | "RULE" | "RECOMMENDATION" | "GENERAL" {
  const m = message.toLowerCase();
  if (/(freeze|float|slide|withdraw|refund)/.test(m)) return "RULE";
  if (/(cutoff|closing rank|opening rank|can i get)/.test(m)) return "CUTOFF";
  if (/(my list|recommend|safer|reorder)/.test(m)) return "RECOMMENDATION";
  return "GENERAL";
}