// src/lib/reminders.ts
import { supabase } from "../supabaseClient";

export async function markReminderProcessing(reminderId: string) {
  await supabase.from("reminders").update({ status: "pending" }).eq("id", reminderId);
}
