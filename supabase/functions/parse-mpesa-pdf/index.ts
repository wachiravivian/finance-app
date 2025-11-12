// supabase/functions/parse-mpesa-pdf/index.ts
// Deno Edge Function that:
// 1) Accepts JSON { url: string } where url is a public or signed URL to the uploaded PDF
// 2) Fetches the PDF, extracts text via pdfjs, parses M-PESA rows
// 3) Inserts transactions into `transactions`

import { serve } from "std/http/server.ts";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.mjs";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { adminClient } from "../_shared_admin.ts"; // you already have this

type TxRow = {
  receipt: string;
  occurred_at: string; // ISO
  details: string;
  paid_in: number;
  paid_out: number;
  balance?: number | null;
};

function okCors(json: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(json), {
    ...init,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "POST,OPTIONS",
      ...(init.headers || {}),
    },
  });
}

function badCors(message: string, status = 400) {
  return okCors({ error: message }, { status });
}

function parseMoney(s: string): number {
  const t = s.replace(/[, ]/g, "").trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Heuristics -> map line details into category + direction */
function categorize(details: string, paid_in: number, paid_out: number) {
  const d = details.toLowerCase();

  if (paid_in > 0) {
    if (d.includes("salary")) return { category: "Income: Salary", direction: "in" as const };
    if (d.includes("business payment") || d.includes("b2c") || d.includes("mali"))
      return { category: "Income: B2C", direction: "in" as const };
    if (d.includes("funds received")) return { category: "Income: P2P", direction: "in" as const };
    return { category: "Income: Other", direction: "in" as const };
  }

  if (paid_out > 0) {
    if (d.includes("pay bill")) return { category: "Bill: Pay Bill", direction: "out" as const };
    if (d.includes("merchant payment")) return { category: "Expense: Merchant", direction: "out" as const };
    if (d.includes("customer payment to small business"))
      return { category: "Expense: Small Business", direction: "out" as const };
    if (d.includes("airtime")) return { category: "Expense: Airtime", direction: "out" as const };
    if (d.includes("bundle")) return { category: "Expense: Data", direction: "out" as const };
    if (d.includes("transfer of funds charge") || d.includes("pay bill charge"))
      return { category: "Fee", direction: "out" as const };
    if (d.includes("customer transfer"))
      return { category: "P2P: Outgoing", direction: "out" as const };
    return { category: "Expense: Other", direction: "out" as const };
  }

  return { category: "Other", direction: null as any };
}

/** Extract counterparty if present */
function extractCounterparty(details: string): string | null {
  const m = details.match(/to\s+([0-9* \-]+)\s*-\s*([A-Za-z.'() \-]+)$/i);
  if (m) return m[2].trim();
  return null;
}

async function pdfToText(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch PDF failed: ${resp.status}`);
  const ab = await resp.arrayBuffer();

  // pdfjs requires a "data" parameter with Uint8Array
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  let full = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str || "").join(" ");
    // keep page separation to help regex spanning pages
    full += strings + "\n";
  }
  return full;
}

/** Parse the "DETAILED STATEMENT" rows from the full text */
function parseMpesaText(txt: string): TxRow[] {
  // Normalize whitespace
  const clean = txt.replace(/\s+Balance\s+/g, " Balance ")
                   .replace(/\s+COMPLETED\s+/g, " COMPLETED ")
                   .replace(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g, " $1 ");

  // Each record usually has:
  // ReceiptNo  YYYY-MM-DD HH:mm:ss  Details ... COMPLETED  PaidIn  PaidOut  Balance
  // PaidIn or PaidOut can be 0.00
  const rowRe =
    /([A-Z0-9]{10,})\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)\s+COMPLETED\s+([0-9,]+\.\d{2})\s+([0-9,]+\.\d{2})\s+([0-9,]+\.\d{2})/g;

  const out: TxRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(clean)) !== null) {
    out.push({
      receipt: m[1],
      occurred_at: new Date(m[2].replace(/\s+/, "T") + "Z").toISOString(),
      details: m[3].trim(),
      paid_in: parseMoney(m[4]),
      paid_out: parseMoney(m[5]),
      balance: parseMoney(m[6]),
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return okCors({ ok: true });
  }

  if (req.method !== "POST") {
    return badCors("Use POST");
  }

  // Verify caller is an ADMIN (reuses your helper)
  const adminCheck = await assertAdmin(req);
  if (!adminCheck.ok) return badCors(adminCheck.error || "Forbidden", 403);

  let payload: { url?: string; for_user_id?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return badCors("Invalid JSON body");
  }

  const url = payload.url?.trim();
  if (!url) return badCors("Missing 'url'");

  const svc = adminClient();
  const targetUserId = payload.for_user_id || adminCheck.user.id;

  try {
    const text = await pdfToText(url);
    const rows = parseMpesaText(text);

    if (rows.length === 0) {
      return badCors("Could not parse any transactions from the PDF (check statement format).", 415);
    }

    const inserts = rows.map((r) => {
      const { category, direction } = categorize(r.details, r.paid_in, r.paid_out);
      const amount = r.paid_in > 0 ? r.paid_in : r.paid_out;
      const counterparty = extractCounterparty(r.details);

      return {
        user_id: targetUserId,
        title: r.details.slice(0, 200),
        category,
        amount,
        created_at: new Date().toISOString(), // when imported
        occurred_at: r.occurred_at,          // when it happened
        source: "mpesa",
        mpesa_receipt: r.receipt,
        mpesa_type: category,                // optional
        direction,
        counterparty,
      };
    });

    // Insert, handle duplicates by receipt if you added a unique index on mpesa_receipt (optional)
    const { data, error } = await svc.from("transactions").insert(inserts).select("id");
    if (error) throw error;

    return okCors({ inserted: data?.length || 0 });
  } catch (e: any) {
    return badCors(e?.message || "Parse failed", 500);
  }
});
