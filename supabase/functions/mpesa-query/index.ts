// @ts-nocheck
// supabase/functions/mpesa-query/index.ts
// Query STK status by CheckoutRequestID and UPDATE payments.status accordingly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- ENV ----
const ENV = (Deno.env.get("MPESA_ENV") ?? "sandbox").toLowerCase(); // 'sandbox' | 'production'
const CONSUMER_KEY = Deno.env.get("MPESA_CONSUMER_KEY")!;
const CONSUMER_SECRET = Deno.env.get("MPESA_CONSUMER_SECRET")!;
const SHORTCODE = Deno.env.get("MPESA_SHORTCODE")!;
const PASSKEY = Deno.env.get("MPESA_PASSKEY")!;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- Daraja base ----
const BASE =
  ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ---- helpers ----
function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function token() {
  const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(
    `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  const j = await res.json();
  return j.access_token as string;
}

function mapResultToStatus(resultCode: number | string | undefined): "success" | "failed" | "pending" {
  // Daraja STK: 0 = success; 1032=cancelled by user; 1xx/2xx/3xx often failure.
  if (resultCode === 0 || resultCode === "0") return "success";
  if (resultCode === undefined || resultCode === null || resultCode === "") return "pending";
  return "failed";
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    const { checkout_request_id } = await req.json();

    if (!checkout_request_id) {
      return Response.json(
        { ok: false, message: "checkout_request_id is required" },
        { status: 400 }
      );
    }

    const access = await token();
    const ts = timestamp();
    const password = btoa(`${SHORTCODE}${PASSKEY}${ts}`);

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkout_request_id,
    };

    const res = await fetch(`${BASE}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log("STK Query:", res.status, data);

    // Figure out resultCode (Daraja returns ResultCode/ResultDesc)
    const resultCode = data?.ResultCode ?? data?.Body?.stkCallback?.ResultCode;
    const status = mapResultToStatus(resultCode);

    // Update payments table if we can find the row
    const { error: upErr } = await admin
      .from("payments")
      .update({ status, raw_callback: data })
      .eq("checkout_request_id", checkout_request_id);

    if (upErr) {
      console.error("payments update error:", upErr);
    }

    return Response.json(
      { ok: res.ok && !data?.errorCode, status, data },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (e) {
    console.error("mpesa-query error:", e);
    return Response.json(
      { ok: false, message: String(e) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
});
