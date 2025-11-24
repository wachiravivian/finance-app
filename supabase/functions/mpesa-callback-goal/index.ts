//mpesa-callback-goal/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cors(resp: Response) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type");
  return new Response(resp.body, { status: resp.status, headers: h });
}

// Use service role for writes
const supabase = createClient(
  Deno.env.get("PROJECT_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    const cb = await req.json(); // M-Pesa callback body

    const stk = cb?.Body?.stkCallback;
    const resultCode = Number(stk?.ResultCode ?? -1);
    const meta = stk?.CallbackMetadata?.Item || [];

    const amount        = Number(meta.find((x: any) => x.Name === "Amount")?.Value ?? 0);
    const phone         = String(meta.find((x: any) => x.Name === "PhoneNumber")?.Value ?? "");
    const mpesaReceipt  = String(meta.find((x: any) => x.Name === "MpesaReceiptNumber")?.Value ?? "");
    const transDateRaw  = String(meta.find((x: any) => x.Name === "TransactionDate")?.Value ?? "");
    const checkoutReqId = String(stk?.CheckoutRequestID ?? "");
    const desc          = String(stk?.ResultDesc ?? "");

    // Goal id sent in AccountReference: "GOAL-<prefix>" or the goal id itself if you prefer.
    const accountRef    = String(stk?.MerchantRequestID ?? "") || ""; // sometimes empty; you can also parse from your desc if you put it there
    // If you sent actual goal_id in TransactionDesc like "Goal <goalId>", parse it:
    const goalIdMatch = (String(stk?.CallbackMetadata?.GoalId ?? "") || String(stk?.ResultDesc ?? ""))
      .match(/Goal\s+([0-9a-f-]+)/i);
    const goalId = goalIdMatch?.[1] || null;

    // Only record successful payments
    if (resultCode === 0 && goalId) {
      // 1) Add a transaction (negative amount = expense or positive if you treat goal top-up as income → choose your convention)
      const { data: goalRow } = await supabase.from("goals").select("id, name").eq("id", goalId).single();

      await supabase.from("transactions").insert([{
        user_id: null, // optional: if you want to attach to a specific user, store it on the request when you initiated STK and pass via callback metadata instead
        title: `Goal top-up: ${goalRow?.name ?? goalId}`,
        category: `goal:${goalId}`,
        amount: amount > 0 ? amount : 0,  // many apps treat top-up as positive "savings"
        mpesa_receipt: mpesaReceipt || null,
      }]);

      // 2) Increment the goal’s saved amount
      await supabase.rpc("inc_goal_amount", { p_goal_id: goalId, p_add: amount });

      // (Optional) Log raw callback
      await supabase.from("mpesa_callbacks").insert([{
        goal_id: goalId,
        phone,
        amount,
        mpesa_receipt: mpesaReceipt,
        payload: cb,
        status_text: "success",
        checkout_request_id: checkoutReqId,
        result_desc: desc,
      }]);
    } else {
      // Log failure
      await supabase.from("mpesa_callbacks").insert([{
        goal_id: goalId ?? null,
        payload: cb,
        status_text: `failed:${resultCode}`,
        result_desc: desc,
        checkout_request_id: checkoutReqId
      }]);
    }

    return cors(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  } catch (e: any) {
    return cors(new Response(JSON.stringify({ error: e?.message || "callback error" }), { status: 500 }));
  }
});
