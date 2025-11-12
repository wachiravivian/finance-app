// src/hooks/useGoals.ts
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
export function useGoals() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);
  return { rows, loading };
}
