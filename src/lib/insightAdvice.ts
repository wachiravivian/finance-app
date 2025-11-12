// src/lib/insightAdvice.ts
export const CLUSTER_TIPS: Record<number, string[]> = {
  0: [
    "Cut back on takeout meals to boost your monthly savings.",
    "Try zero-based budgeting: give every shilling a job.",
  ],
  1: [
    "Automate savings right after income hits your account.",
    "Cap entertainment to a fixed weekly envelope.",
  ],
  2: [
    "Increase emergency fund to 3–6 months of expenses.",
    "Consider paying down high-interest debt first (avalanche).",
  ],
};

export function adviceFor(cluster?: number) {
  return CLUSTER_TIPS[cluster ?? 0] ?? CLUSTER_TIPS[0];
}
