// supabase/functions/_shared/mpesa-categories.ts
export type Category =
  | "groceries"
  | "utilities"
  | "entertainment"
  | "transport"
  | "airtime"
  | "data"
  | "withdrawal"
  | "bill_payment"
  | "p2p_transfer"
  | "income"
  | "fees"
  | "other";

const CATEGORY_PATTERNS: Record<Category, RegExp[]> = {
  groceries: [/naivas/i, /quickmart/i, /carrefour/i, /chandarana/i],
  utilities: [/kplc/i, /electric/i, /power/i, /water/i, /zuku/i, /dstv/i, /gotv/i],
  entertainment: [/betika/i, /sportpesa/i, /netflix/i, /showmax/i, /viu/i],
  transport: [/bolt/i, /uber/i, /swvl/i, /fuel/i, /shell/i, /total/i, /rubis/i],
  airtime: [/airtime/i, /top\s?up/i],
  data: [/bundle/i, /data/i],
  withdrawal: [/withdraw/i, /agent/i, /atm/i, /cash/i],
  bill_payment: [/pay\s?bill/i, /bill\s?payment/i, /kplc/i, /zuku/i, /dstv/i],
  p2p_transfer: [/sent to/i, /transfer to/i, /customer transfer/i],
  income: [/received/i, /deposit/i, /reversal/i, /from/i],
  fees: [/charge/i, /fee/i, /transaction cost/i],
  other: [/.*/],
};

export function categorizeDescription(desc: string): Category {
  const text = desc.toLowerCase();
  for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some((r) => r.test(text))) return cat as Category;
  }
  return "other";
}
