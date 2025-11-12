// src/hooks/useAuth.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

type Profile = {
  id: string;
  email?: string;
  role?: string | null;
  display_name?: string | null;
  phone?: string | null;
  last_seen_at?: string | null;
};

const ADMIN_EMAILS = new Set([
  // Add any super-admin emails here:
  "vivianwachuu@gmail.com",
]);

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      // 1) fetch minimal profile
      const { data: profileRow, error } = await supabase
        .from("profiles")
        .select("id, role, display_name, phone, last_seen_at")
        .eq("id", uid)
        .limit(1)
        .maybeSingle();

      if (error) {
        // If missing profile row, you can keep going; just run with limited info
        // (In case RLS prevents inserts, avoid auto-insert here)
        setProfile({
          id: uid,
          email: session?.user?.email ?? undefined,
          role: undefined,
          display_name: undefined,
          phone: undefined,
          last_seen_at: undefined,
        });
      } else {
        setProfile({
          ...(profileRow ?? { id: uid }),
          email: session?.user?.email ?? undefined,
        });
      }

      // 2) Non-blocking activity ping (ignore errors)
      (async () => {
        try {
          await supabase
            .from("profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", uid);
        } catch {
          // ignore
        }
      })();
    } else {
      setProfile(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!active) return;
      await hydrate();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Re-hydrate on any auth change
      void hydrate();
    });

    return () => {
      active = false;
      sub.subscription?.unsubscribe();
    };
  }, [hydrate]);

  const isAdmin =
    (profile?.role ?? "user").toLowerCase() === "admin" ||
    (profile?.email ? ADMIN_EMAILS.has(profile.email) : false);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Caller (UI) should navigate to AuthStack after this resolves
  }, []);

  return {
    loading,
    userId,
    profile,
    isAdmin,
    refresh,
    signOut,
  } as const;
}
