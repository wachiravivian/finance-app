// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ENV
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MPESA_CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY")!;
const MPESA_CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET")!;
const MPESA_SHORTCODE = Deno.env.get("MPESA_SHORTCODE")!;
const MPESA_PASSKEY = Deno.env.get("MPESA_PASSKEY")!;
const MPESA_CALLBACK_URL = Deno.env.get("MPESA_CALLBACK_URL")!; // your deployed mpesa-callback

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- In-memory token cache (per function instance) ----
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }
  const auth = btoa(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`);
  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } },
  );
  const data = await res.json();
  // token life is 3600s; cache for ~55min
  cachedToken = { token: data.access_token, expiresAt: now + 55 * 60 * 1000 };
  return data.access_token;
}

function timestamp14() {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

serve(async (req) => {
  try {
    const { userId, phone, amount, clientTxId } = await req.json();
    if (!userId || !phone || !amount || !clientTxId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // pre-create payments row (PENDING)
    const { error: insErr, data: payRow } = await supabase
      .from("payments")
      .insert([{ user_id: userId, phone, amount, client_tx_id: clientTxId }])
      .select()
      .single();
    if (insErr) throw insErr;

    const token = await getAccessToken();
    const ts = timestamp14();
    const password = btoa(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`);

    const body = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      // Include both userId and clientTxId so callback can reconcile
      AccountReference: `FinanceApp:${userId}:${clientTxId}`,
      TransactionDesc: "FinanceApp STK",
    };

    const res = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    // update payments with request IDs
    await supabase
      .from("payments")
      .update({
        merchant_request_id: data.MerchantRequestID ?? null,
        checkout_request_id: data.CheckoutRequestID ?? null,
      })
      .eq("id", payRow.id);

    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
