import { supabase } from "../supabaseClient";

export async function payWithMpesa(phone: string, amount: number) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const clientTxId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

  // 1) Optimistic transaction row (shows immediately in UI)
  await supabase.from("transactions").insert([
    {
      user_id: userId,
      title: "M-Pesa Payment",
      amount: -Number(amount),
      category: "M-Pesa",
      source: "mpesa",
      is_pending: true,
      client_tx_id: clientTxId,
      note: "Awaiting M-Pesa confirmation",
    },
  ]);

  // 2) Call hosted edge function
  const { data, error } = await supabase.functions.invoke("mpesa-stk", {
    body: { userId, phone, amount, clientTxId },
  });
  if (error) throw error;
  return data;
}
