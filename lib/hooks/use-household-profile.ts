"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export type HouseholdMember = {
  id: string;
  user_id: string;
  display_name: string | null;
  default_servings: number;
  dietary_restrictions: string[];
  is_current_user?: boolean;
};

export function useHouseholdProfile(householdId: string | null, currentUserId: string | null) {
  const [householdName, setHouseholdNameState] = useState<string>("Mi hogar");
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!householdId) {
      setHouseholdNameState("Mi hogar");
      setMembers([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [hRes, mRes] = await Promise.all([
      supabase.from("households").select("name").eq("id", householdId).single(),
      supabase
        .from("household_members")
        .select("id, user_id, display_name, default_servings, dietary_restrictions")
        .eq("household_id", householdId),
    ]);
    setHouseholdNameState((hRes.data?.name as string) ?? "Mi hogar");
    const list: HouseholdMember[] = (mRes.data ?? []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      display_name: m.display_name ?? null,
      default_servings: typeof m.default_servings === "number" ? m.default_servings : 1,
      dietary_restrictions: Array.isArray(m.dietary_restrictions) ? m.dietary_restrictions : [],
      is_current_user: m.user_id === currentUserId,
    }));
    setMembers(list);
    setLoading(false);
  }, [householdId, currentUserId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const setHouseholdName = useCallback(
    async (name: string) => {
      if (!householdId || !name.trim()) return;
      const supabase = createClient();
      await supabase.from("households").update({ name: name.trim() }).eq("id", householdId);
      setHouseholdNameState(name.trim());
    },
    [householdId]
  );

  const updateMember = useCallback(
    async (
      memberId: string,
      updates: {
        display_name?: string | null;
        default_servings?: number;
        dietary_restrictions?: string[];
      }
    ) => {
      if (!householdId) return;
      const supabase = createClient();
      const payload: {
        display_name?: string | null;
        default_servings?: number;
        dietary_restrictions?: string[];
      } = {};
      if (updates.display_name !== undefined) payload.display_name = updates.display_name || null;
      if (updates.default_servings !== undefined)
        payload.default_servings = Math.max(1, Math.min(20, updates.default_servings));
      if (updates.dietary_restrictions !== undefined)
        payload.dietary_restrictions = updates.dietary_restrictions;
      await supabase.from("household_members").update(payload).eq("id", memberId).eq("household_id", householdId);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? {
                ...m,
                display_name: payload.display_name !== undefined ? payload.display_name : m.display_name,
                default_servings: payload.default_servings ?? m.default_servings,
                dietary_restrictions: payload.dietary_restrictions ?? m.dietary_restrictions,
              }
            : m
        )
      );
    },
    [householdId]
  );

  return { householdName, members, setHouseholdName, updateMember, loading, reload: load };
}
