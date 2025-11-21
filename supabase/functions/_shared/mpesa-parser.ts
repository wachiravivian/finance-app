// supabase/functions/_shared/mpesa-parser.ts
import { categorizeDescription } from "./mpesa-categories.ts";
import { extractMerchant } from "./mpesa-merchants.ts";

export type ParsedTransaction = {
  occurred_at: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  receipt?: string;
  merchant?: string;
};

// Utility helpers
function kshToNumber(raw: string): number {
  const clean = raw.replace(/[, ]/g, "").replace(/(ksh|kes|=)/gi, "").replace(/[^\d.\-]/g, "");
  const n = Number(clean);
  return isFinite(n) ? n : 0;
}

function parseKenyanDate(raw: string): Date | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyy, hh, min] = m;
    const d = new Date(+yyyy, +mm - 1, +dd, hh ? +hh : 0, min ? +min : 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// 🔹 Smarter direction detection (for PDFs missing clear debit/credit columns)
function inferDirection(details: string): "income" | "expense" {
  const t = details.toLowerCase();
  if (/(received|deposit|reversal|refund|from)/i.test(t)) return "income";
  if (/(sent to|transfer to|withdraw|paybill|buy goods|airtime|bundle|fee|charge|agent)/i.test(t))
    return "expense";
  return "expense";
}

export function parseMpesaText(allText: string): ParsedTransaction[] {
  const lines = allText
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, " ").trim())
    .filter(Boolean);

  const txs: ParsedTransaction[] = [];
  const tableRow =
    /^([A-Z0-9]{6,})?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{1,2}:\d{2})?)\s{1,}(.+?)\s{2,}([\-–]?\s?(?:KSH|KES)?\s?[\d,]+\.\d{2}|\-)\s{2,}([\-–]?\s?(?:KSH|KES)?\s?[\d,]+\.\d{2}|\-)/i;

  for (const raw of lines) {
    const m = raw.match(tableRow);
    if (!m) continue;

    const [_, receipt, whenRaw, details, debitRaw, creditRaw] = m;
    const when = parseKenyanDate(whenRaw);
    const debit = debitRaw === "-" ? 0 : kshToNumber(debitRaw);
    const credit = creditRaw === "-" ? 0 : kshToNumber(creditRaw);
    if (!when) continue;

    const type =
      debit > 0 || credit > 0
        ? credit > debit
          ? "income"
          : "expense"
        : inferDirection(details);

    const amount = type === "income" ? credit || debit : debit || credit;
    const autoCategory = categorizeDescription(details);
    const merchant = extractMerchant(details);

    txs.push({
      occurred_at: when.toISOString(),
      description: details,
      type,
      category: autoCategory,
      amount: Math.abs(amount),
      receipt: receipt || "",
      merchant,
    });
  }

  // --- Deduplicate & filter ---
  const merged: Record<string, ParsedTransaction> = {};
  for (const t of txs) {
    const key = t.receipt || `${t.description}-${t.occurred_at}`;
    const lower = t.description.toLowerCase();
    if (/charge|reversal|system|api initiator|sandbox/i.test(lower)) continue;
    if (!merged[key]) merged[key] = t;
  }

  return Object.values(merged);
}
