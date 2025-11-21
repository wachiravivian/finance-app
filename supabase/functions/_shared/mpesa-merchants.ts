// supabase/functions/_shared/mpesa-merchants.ts
export function extractMerchant(desc: string): string {
  const text = desc.toLowerCase();

  const known: Record<string, RegExp> = {
    Naivas: /naivas/,
    Quickmart: /quickmart/,
    Carrefour: /carrefour/,
    KPLC: /kplc|kenya\s*power|electric/,
    Zuku: /zuku/,
    DSTV: /dstv|gotv/,
    Betika: /betika/,
    SportPesa: /sportpesa/,
    Shell: /shell/,
    TotalEnergies: /total/,
    Rubis: /rubis/,
    Netflix: /netflix/,
    Showmax: /showmax/,
    Safaricom: /safaricom/,
    Equity: /equity/,
    "Co-op Bank": /co.?op/,
    KCB: /\bkcb\b/,
    NCBA: /ncba/,
  };

  for (const [merchant, rx] of Object.entries(known)) {
    if (rx.test(text)) return merchant;
  }

  const m = text.match(/(?:to|at|from|by)\s+([A-Za-z\s&]+)(?:\s+(?:TILL|PAYBILL|REF|ACCOUNT|AGENT))/i);
  if (m) return m[1].trim();

  const till = text.match(/(?:till|paybill|agent)\s+(\d+)/i);
  if (till) return `TILL ${till[1]}`;

  const capital = desc.match(/\b[A-Z][A-Za-z&\s]{2,}\b/g);
  if (capital && capital.length) return capital[0].trim();

  return "Unknown";
}
