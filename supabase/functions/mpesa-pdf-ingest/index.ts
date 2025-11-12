// supabase/functions/mpesa-pdf-ingest/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs";

// ENV: set in Dashboard → Functions → Environment variables
// PROJECT_URL (e.g., https://...supabase.co)
// SERVICE_ROLE_KEY (service_role)
// STATEMENTS_BUCKET = "statements"
const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const STATEMENTS_BUCKET = Deno.env.get("STATEMENTS_BUCKET") || "statements";

const ADMIN = createClient(PROJECT_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function ok(data: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...init.headers,
    },
  });
}
function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function parseMpesaTextToRows(text: string) {
  // Very robust but generic parser. Adjust patterns for your statement format.
  // Typical cues:
  //  - "Received from <name>"
  //  - "Paid to <name>" or "Pay Bill" / "Buy Goods"
  //  - "M-PESA balance ..." etc.
  //  - Dates like 12/10/2025 or 2025-10-12; amounts like 1,234.56
  // This assumes each transaction spans one line or lines with consistent keywords.

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const rows: Array<{
    created_at?: string;
    title: string;
    category: string;
    amount: number;
    source: string;
    mpesa_ref?: string | null;
    counterparty?: string | null;
  }> = [];

  // Helpers
  const parseAmount = (s: string) => {
    // strip commas and currency text
    const num = s.replace(/[^\d.\-]/g, "");
    const v = Number(num);
    return isFinite(v) ? v : 0;
  };
  const dateLike = (s: string) =>
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(s);

  for (const raw of lines) {
    const l = raw.replace(/\s+/g, " "); // normalize

    // Try to detect reference
    const refMatch = l.match(/\b([A-Z0-9]{10,})\b/); // e.g., QAB12XYZ34
    const mpesa_ref = refMatch ? refMatch[1] : null;

    // Amount (first match)
    const amtMatch = l.match(/((?:KES|KShs?|Shs?)\s*)?(-?\d[\d,]*(?:\.\d+)?)/i);
    const amount = amtMatch ? parseAmount(amtMatch[0]) : 0;

    // Simple routing by phrase:
    let category = "Other";
    let title = l;
    let counterparty: string | null = null;
    let sign = 0;

    if (/received from/i.test(l) || /customer deposit/i.test(l) || /loan disbursed/i.test(l)) {
      category = "Income";
      sign = +1;
      const who = l.match(/received from\s+([^,]+)/i) || l.match(/from\s+([^,]+)/i);
      counterparty = who?.[1]?.trim() ?? null;
      title = `Received from ${counterparty ?? "Unknown"}`;
    } else if (/paid to/i.test(l) || /pay bill/i.test(l) || /buy goods/i.test(l) || /till/i.test(l) || /send money/i.test(l)) {
      category = /pay bill/i.test(l) ? "Pay Bill" :
                 /buy goods|till/i.test(l) ? "Buy Goods/Till" :
                 /send money/i.test(l) ? "P2P Transfer" : "Expense";
      sign = -1;
      const who = l.match(/paid to\s+([^,]+)/i) || l.match(/to\s+([^,]+)/i);
      counterparty = who?.[1]?.trim() ?? null;
      title = `Paid to ${counterparty ?? "Unknown"}`;
    } else if (/reversal/i.test(l)) {
      category = "Reversal";
      // reversal usually compensates an earlier transaction (could be +)
      sign = amount >= 0 ? +1 : -1;
      title = "Reversal";
    } else {
      // Unknown lines are skipped if they don't look like transactions
      if (!amtMatch) continue;
      sign = amount >= 0 ? +1 : -1;
      title = "M-PESA entry";
    }

    // Date detection (very approximate; many statements include a date at start)
    let created_at: string | undefined;
    const firstToken = l.split(" ")[0];
    if (dateLike(firstToken)) {
      const iso = new Date(firstToken).toISOString();
      if (!Number.isNaN(new Date(iso).getTime())) created_at = iso;
    }

    rows.push({
      created_at,
      title,
      category,
      amount: sign * Math.abs(amount),
      source: "mpesa",
      mpesa_ref,
      counterparty,
    });
  }

  return rows;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return ok({}, { headers: { "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace("Bearer ", "").trim();
    if (!jwt) return bad("Missing auth token", 401);

    // who is this?
    const { data: { user }, error: userErr } = await ADMIN.auth.getUser(jwt);
    if (userErr || !user) return bad("Invalid token", 401);

    const { path } = await req.json(); // storage object path (e.g., "<uid>/Jan2025.pdf")
    if (!path || typeof path !== "string") return bad("Missing path");

    // Make sure the caller owns this path
    if (!path.startsWith(user.id)) return bad("Forbidden path", 403);

    // Generate signed URL and fetch the file
    const { data: signed, error: signedErr } = await ADMIN.storage.from(STATEMENTS_BUCKET)
      .createSignedUrl(path, 60 * 5);
    if (signedErr) return bad("Unable to sign URL");

    const fileRes = await fetch(signed.signedUrl);
    const buf = new Uint8Array(await fileRes.arrayBuffer());

    // Parse PDF → text
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;
    let allText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((it: any) => it.str ?? "").join(" ");
      allText += pageText + "\n";
    }

    const rows = parseMpesaTextToRows(allText);

    // Insert raw_statements audit row
    await ADMIN.from("raw_statements").insert({
      user_id: user.id,
      storage_path: path,
      pages: pdf.numPages,
      raw_text: allText.slice(0, 50000), -- keep to a sensible limit
    });

    if (!rows.length) return ok({ inserted: 0, message: "No recognizable transactions." });

    // Normalize rows to DB columns
    const txRows = rows.map(r => ({
      user_id: user.id,
      title: r.title,
      category: r.category,
      amount: r.amount,                 -- NOTE: negative for expenses, positive for income
      created_at: r.created_at ?? new Date().toISOString(),
      source: r.source,
      mpesa_ref: r.mpesa_ref ?? null,
      counterparty: r.counterparty ?? null,
    }));

    // Insert (use upsert by (user_id, mpesa_ref, created_at) if you want idempotency)
    const { error: insErr } = await ADMIN.from("transactions").insert(txRows);
    if (insErr) return bad(insErr.message);

    // Refresh profile so Insights update immediately
    await ADMIN.rpc("refresh_financial_profile", { p_user: user.id });

    return ok({ inserted: txRows.length });
  } catch (e) {
    return bad((e as Error)?.message ?? "Server error", 500);
  }
});
