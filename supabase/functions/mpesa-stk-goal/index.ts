// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS helper
function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function btoaUtf8(str: string) {
  return btoa(unescape(encodeURIComponent(str)));
}

function nowTimestamp() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    const {
      DARAJA_ENV = "sandbox", // "sandbox" | "production"
      DARAJA_CONSUMER_KEY,
      DARAJA_CONSUMER_SECRET,
      DARAJA_PASSKEY,
      DARAJA_SHORTCODE,
      MPESA_CALLBACK_GOAL, // full https URL of the callback function below
    } = Deno.env.toObject();

    if (!DARAJA_CONSUMER_KEY || !DARAJA_CONSUMER_SECRET || !DARAJA_PASSKEY || !DARAJA_SHORTCODE || !MPESA_CALLBACK_GOAL) {
      return cors(new Response(JSON.stringify({ error: "Missing M-Pesa env vars" }), { status: 500 }));
    }

    const body = await req.json();
    const amount = Math.round(Number(body?.amount || 0));
    const phone  = String(body?.phone || "").replace(/\D/g, "");
    const goalId = String(body?.goal_id || "");
    const accountReference = (body?.account_ref as string) || `GOAL-${goalId.slice(0,8)}`;

    if (!amount || amount < 1) {
      return cors(new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400 }));
    }
    if (!/^2547\d{8}$/.test(phone)) {
      return cors(new Response(JSON.stringify({ error: "Phone must be 2547XXXXXXXX" }), { status: 400 }));
    }
    if (!goalId) {
      return cors(new Response(JSON.stringify({ error: "Missing goal_id" }), { status: 400 }));
    }

    // 1) OAuth token
    const domain = DARAJA_ENV === "production" ? "api.safaricom.co.ke" : "sandbox.safaricom.co.ke";
    const oauth = await fetch(`https://${domain}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: "Basic " + btoa(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`),
      },
    });
    const tokenJson = await oauth.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) {
      return cors(new Response(JSON.stringify({ error: "Failed to get access token", tokenJson }), { status: 500 }));
    }

    // 2) STK push
    const Timestamp = nowTimestamp();
    const Password = btoaUtf8(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${Timestamp}`);

    const stkPayload = {
      BusinessShortCode: DARAJA_SHORTCODE,
      Password,
      Timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: DARAJA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_GOAL,
      AccountReference: accountReference,
      TransactionDesc: `Goal ${goalId}`,
    };

    const stkRes = await fetch(`https://${domain}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const json = await stkRes.json();
    // Return raw Daraja response (front-end can show status message)
    return cors(new Response(JSON.stringify(json), { status: 200 }));
  } catch (e: any) {
    return cors(new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500 }));
  }
});
