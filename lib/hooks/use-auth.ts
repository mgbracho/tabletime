"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u ? { id: u.id, email: u.email ?? undefined } : null);
    if (!u) {
      setHouseholdId(null);
      setLoading(false);
      return;
    }
    const { data: members } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", u.id)
      .limit(1);
    const hid = members?.[0]?.household_id ?? null;
    setHouseholdId(hid);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.unsubscribe();
  }, [refresh]);

  const ensureHousehold = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/household/ensure", {
      method: "POST",
      credentials: "include",
      headers: {
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[TableTime] ensureHousehold falló:", res.status, text);
      return null;
    }
    const data = await res.json();
    const household_id = data?.household_id ?? null;
    if (household_id) setHouseholdId(household_id);
    return household_id;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setHouseholdId(null);
    window.location.href = "/";
  }, []);

  return { user, householdId, loading, ensureHousehold, signOut, refresh };
}
