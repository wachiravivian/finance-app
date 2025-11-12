// src/lib/payments.ts
import { supabase } from "../supabaseClient";

/** Normalize to 2547XXXXXXXX */
export function sanitizePhone(input: string) {
  const digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("7")) return "254" + digits;
  return digits;
}

/** Call the Edge Function `mpesa-stk-goal` to trigger an STK push */
export async function payGoalStk(params: {
  goal_id: string;
  amount: number;
  phone: string;
}) {
  const { goal_id, amount, phone } = params;

  const sessionRes = await supabase.auth.getSession();
  const session = sessionRes.data.session;
  if (!session) throw new Error("Please sign in first.");

  const payload = {
    goal_id,
    amount: Math.round(Number(amount) || 0),
    phone: sanitizePhone(phone),
  };

  const { data, error } = await supabase.functions.invoke("mpesa-stk-goal", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: payload,
  });

  if (error) {
    throw new Error(error.message || "STK request failed.");
  }

  // Daraja returns ResponseCode === "0" when the push is accepted.
  if (data?.ResponseCode !== "0") {
    const msg =
      data?.ResponseDescription ||
      data?.errorMessage ||
      "STK request not accepted by M-Pesa.";
    throw new Error(msg);
  }

  // Useful fields:
  // data.CheckoutRequestID, data.CustomerMessage, data.MerchantRequestID
  return data;
}
