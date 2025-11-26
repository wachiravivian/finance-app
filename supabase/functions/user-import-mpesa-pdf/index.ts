//user-import-mpesa-pdf/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseMpesaText } from "../_shared/mpesa-parser.ts";

function corsHeaders(origin: string | null, req?: Request) {
  const reqHdrs = req?.headers.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      reqHdrs ?? "authorization, apikey, content-type",
  };
}

async function extractText(pdfBytes: Uint8Array): Promise<string> {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.6.82/legacy/build/pdf.worker.mjs";

  const pdf = await (pdfjsLib as any).getDocument({ data: pdfBytes }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str ?? "").join(" ") + "\n";
  }
  try {
    await pdf.destroy();
  } catch {}
  return text;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    const PROJECT_URL = Deno.env.get("PROJECT_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const admin = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!token) throw new Error("Missing Bearer token");

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) throw new Error("Invalid token");
    const userId = userData.user.id;

    const pdfBytes = new Uint8Array(await req.arrayBuffer());
    const extractedText = await extractText(pdfBytes);
    const txs = parseMpesaText(extractedText);

    if (!txs.length)
      return new Response(JSON.stringify({ imported: 0, message: "No valid transactions found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });

    const rows = txs.map((t) => ({
      user_id: userId,
      title: t.description.slice(0, 120),
      category: t.category,
      merchant: t.merchant,
      amount: t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount),
      occurred_at: t.occurred_at,
      type: t.type,
      description: t.description,
      created_at: new Date().toISOString(),
    }));

    const { error: insErr } = await admin.from("transactions").insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ imported: rows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e: any) {
    console.error("PDF import error:", e);
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});
