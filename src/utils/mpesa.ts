// src/utils/mpesa.ts
export async function pollStkStatus(supabase: any, checkoutRequestId: string, { intervalMs = 4000, maxAttempts = 10 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase.functions.invoke("mpesa-query", {
      body: { checkout_request_id: checkoutRequestId },
    });
    if (error) throw error;

    const status = data?.status as "success" | "failed" | "pending" | undefined;
    if (status === "success" || status === "failed") {
      return { status, data };
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { status: "pending" };
}
