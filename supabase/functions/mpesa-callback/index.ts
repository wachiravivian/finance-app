// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

serve(async (req) => {
  try {
    const payload = await req.json(); // LNMO callback body
    // Extract essentials safely
    const ResultCode = payload?.Body?.stkCallback?.ResultCode;
    const Metadata = payload?.Body?.stkCallback?.CallbackMetadata?.Item ?? [];
    const lookup = (name: string) => Metadata.find((i: any) => i.Name === name)?.Value;

    if (ResultCode !== 0) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const mpesa_receipt = lookup("MpesaReceiptNumber");
    const amount = Number(lookup("Amount") ?? 0);
    const phone = String(lookup("PhoneNumber") ?? "");

    // Resolve user by phone in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (!profile?.id) {
      // If you can’t resolve a user, you can stash to a holding table instead.
      return new Response(JSON.stringify({ ok: false, reason: "user_not_found_by_phone" }), { status: 200 });
    }

    // Insert or ignore duplicate receipt
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: profile.id,
        source: "mpesa",
        mpesa_receipt,
        title: "M-PESA Payment",
        category: "payments",
        amount,
        occurred_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error && !String(error.message).includes("duplicate")) {
      return new Response(JSON.stringify({ ok: false, error: String(error.message) }), { status: 200 });
    }

    const transactionId = tx?.id;

    // Optional: link a pending reminder for same amount within ±48h
    if (transactionId) {
      const since = new Date(); since.setDate(since.getDate() - 2);
      const until = new Date(); until.setDate(until.getDate() + 2);
      const { data: reminder } = await supabase
        .from("reminders")
        .select("id")
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .gte("schedule_at", since.toISOString())
        .lte("schedule_at", until.toISOString())
        .gte("amount", amount * 0.99)
        .lte("amount", amount * 1.01)
        .limit(1)
        .maybeSingle();

      if (reminder?.id) {
        await supabase.from("reminders").update({ status: "paid", transaction_id: transactionId }).eq("id", reminder.id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }
});
