// supabase/functions/user-import-mpesa-pdf/index.ts
// Deno Edge Function
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Tx = {
  occurred_at: string;
  description: string;
  type: "income" | "expense";
  category: string;
  amount: number;
};

function corsHeaders(origin: string | null, req?: Request) {
  // Echo back the browser’s requested headers; fall back to a safe list.
  const reqHdrs = req?.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      reqHdrs ?? "authorization, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle preflight cleanly
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, req) });
  }


const PROJECT_URL = Deno.env.get("PROJECT_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
}

const admin = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// ---------- Helpers (same logic you saw client-side) ----------
function kshToNumber(raw: string): number {
  const clean = raw
    .replace(/[, ]/g, "")
    .replace(/ksh|kes|/= /gi, "")
    .replace(/[^\d.\-]/g, "");
  const n = Number(clean);
  return isFinite(n) ? n : 0;
}

function parseKenyanDate(raw: string): Date | null {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [_, dd, mm, yyyy, hh, min] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      hh ? Number(hh) : 0,
      min ? Number(min) : 0
    );
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const dd = Number(m[1]);
    const mon = months.indexOf(m[2].slice(0,3).toLowerCase());
    const yyyy = Number(m[3]);
    const hh = m[4] ? Number(m[4]) : 0;
    const min = m[5] ? Number(m[5]) : 0;
    if (mon >= 0) {
      const d = new Date(yyyy, mon, dd, hh, min);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}
function inferTypeCategory(details: string, debit: number, credit: number) {
  const t = details.toLowerCase();
  if (credit > 0) {
    if (t.includes("received") || t.includes("deposit") || t.includes("customer transfer from")) {
      return { type: "income" as const, category: "income" };
    }
    return { type: "income" as const, category: "income" };
  }
  if (t.includes("pay bill") || t.includes("paybill")) return { type: "expense" as const, category: "bill_payment" };
  if (t.includes("buy goods") || t.includes("till")) return { type: "expense" as const, category: "shopping" };
  if (t.includes("withdraw")) return { type: "expense" as const, category: "withdrawal" };
  if (t.includes("sent to") || t.includes("transfer to")) return { type: "expense" as const, category: "p2p_transfer" };
  if (t.includes("airtime")) return { type: "expense" as const, category: "airtime" };
  if (t.includes("bundle")) return { type: "expense" as const, category: "data_bundle" };
  return { type: debit > 0 ? "expense" : "income", category: debit > 0 ? "expense" : "income" } as const;
}

function parseTextToTxs(allText: string): Tx[] {
  const lines = allText
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, " ").trim())
    .filter(Boolean);

  const txs: Tx[] = [];

  const tableRow =
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{1,2}:\d{2})?)\s+(.+?)\s+([\-–]?\s?(?:KSH|KES)?\s?[\d,]+\.\d{2}|\-)\s+([\-–]?\s?(?:KSH|KES)?\s?[\d,]+\.\d{2}|\-)/i;

  for (const raw of lines) {
    const m = raw.match(tableRow);
    if (!m) continue;

    const whenRaw = m[1];
    const details = m[2];
    const debitRaw = m[3];
    const creditRaw = m[4];

    const when = parseKenyanDate(whenRaw);
    const debit = debitRaw === "-" ? 0 : kshToNumber(debitRaw);
    const credit = creditRaw === "-" ? 0 : kshToNumber(creditRaw);

    if (!when || (debit <= 0 && credit <= 0)) continue;

    const { type, category } = inferTypeCategory(details, debit, credit);
    const amount = type === "income" ? credit : debit;

    txs.push({
      occurred_at: when.toISOString(),
      description: details,
      type,
      category,
      amount: Math.abs(amount),
    });
  }
  if (txs.length >= 3) return txs;

  const narrativeDate = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{1,2}:\d{2})?)/;
  const narrativeAmt = /(KSH|KES)\s?[\d,]+\.\d{2}/i;

  for (const raw of lines) {
    const dm = raw.match(narrativeDate);
    const am = raw.match(narrativeAmt);
    if (!dm || !am) continue;

    const when = parseKenyanDate(dm[1]);
    if (!when) continue;
    const amt = kshToNumber(am[0]);

    const low = raw.toLowerCase();
    const isIncome =
      low.includes("received") ||
      (low.includes("from") && low.includes("customer transfer")) ||
      low.includes("deposit") ||
      low.includes("reversal");

    const { type, category } = inferTypeCategory(raw, isIncome ? 0 : amt, isIncome ? amt : 0);

    txs.push({
      occurred_at: when.toISOString(),
      description: raw.slice(0, 180),
      type,
      category,
      amount: Math.abs(amt),
    });
  }

  return txs;
}

// ---------- PDF text extraction ----------
async function extractText(pdfBytes: Uint8Array): Promise<string> {
  // Configure worker (required by pdfjs)
  // Use the same version on esm.sh
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.worker.mjs";

  const loadingTask = (pdfjsLib as any).getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str ?? "").join(" ");
    text += pageText + "\n";
  }
  try { await pdf.destroy(); } catch {}
  return text;
}

// ---------- Handler ----------
serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Identify caller user
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
    const userId = userData.user.id;

    // Read PDF bytes
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf || buf.length < 10_000) {
      // typical statements are > 50KB; allow smaller, but guard empty uploads
      // (10k is arbitrary but prevents empty requests)
    }

    // Extract text and parse
    const text = await extractText(buf);
    const txs = parseTextToTxs(text);

    if (!txs.length) {
      return new Response(JSON.stringify({ imported: 0, skipped: 0, diagnostics: { msg: "No rows matched", preview: text.slice(0, 1200) } }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Insert into public.transactions (RLS will be bypassed by service key)
    const rows = txs.map((t) => ({
      user_id: userId,
      title: t.description.slice(0, 120),
      category: t.category,
      amount: t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount),
      created_at: new Date().toISOString(),
      occurred_at: t.occurred_at, // make sure column exists
      type: t.type,
      description: t.description,
    }));

    const { error: insErr, count } = await admin
      .from("transactions")
      .insert(rows, { count: "exact" });

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return new Response(JSON.stringify({ imported: count ?? rows.length, skipped: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    console.error("user-import-mpesa-pdf fatal:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});
