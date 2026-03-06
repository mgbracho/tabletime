"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

const STORAGE_KEY = "tabletime-v1";
const MEAL_TYPES = ["Desayuno", "Comida", "Cena"] as const;
type MealType = (typeof MEAL_TYPES)[number];

export type Recipe = {
  id: string;
  title: string;
  ingredients?: string;
  instructions?: string;
  tags?: string[];
};

export type PlanState = Record<string, string>;
export type ThemeDays = Record<number, Partial<Record<MealType, string>>>;

function migrateThemeDays(raw: unknown): ThemeDays {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const result: ThemeDays = {};
  for (let i = 0; i < 7; i++) {
    const v = obj[String(i)];
    if (typeof v === "string" && v.trim()) {
      result[i] = { Cena: v.trim() };
    } else if (v && typeof v === "object" && "theme" in v && typeof (v as { theme: string; applyTo?: string }).theme === "string") {
      const e = v as { theme: string; applyTo?: string };
      const applyTo: MealType = MEAL_TYPES.includes((e.applyTo ?? "") as MealType) ? (e.applyTo as MealType) : "Cena";
      if (e.theme.trim()) result[i] = { ...result[i], [applyTo]: e.theme.trim() };
    } else if (v && typeof v === "object" && (MEAL_TYPES.some((m) => m in v))) {
      const day = v as Partial<Record<MealType, string>>;
      const themes: Partial<Record<MealType, string>> = {};
      for (const m of MEAL_TYPES) {
        if (typeof day[m] === "string" && day[m].trim()) themes[m] = day[m].trim();
      }
      if (Object.keys(themes).length > 0) result[i] = themes;
    }
  }
  return result;
}

function loadFromStorage(): {
  recipes: Recipe[];
  plan: PlanState;
  manualGroceryItems: { id: string; label: string }[];
  groceryCheckedIds: string[];
  themeDays: ThemeDays;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      recipes?: Recipe[];
      plan?: PlanState;
      manualGroceryItems?: { id: string; label: string }[];
      groceryCheckedIds?: string[];
      themeDays?: unknown;
    };
    if (!data || typeof data !== "object") return null;
    return {
      recipes: Array.isArray(data.recipes) ? data.recipes : [],
      plan: data.plan && typeof data.plan === "object" ? data.plan : {},
      manualGroceryItems: Array.isArray(data.manualGroceryItems) ? data.manualGroceryItems : [],
      groceryCheckedIds: Array.isArray(data.groceryCheckedIds) ? data.groceryCheckedIds : [],
      themeDays: migrateThemeDays(data.themeDays),
    };
  } catch {
    return null;
  }
}

const INITIAL_RECIPES: Recipe[] = [
  { id: "1", title: "Pasta con tomate", ingredients: "400g pasta\n1 bote tomate triturado\n2 dientes de ajo\nAceite de oliva\nAlbahaca", tags: ["rápida", "vegetariana"] },
  { id: "2", title: "Tacos de pollo", ingredients: "500g pechuga de pollo\nTortillas de maíz\nLechuga\nTomate\nQueso rallado\nCrema ácida", tags: ["kid-friendly", "alta proteína"] },
  { id: "3", title: "Sopa de verduras", ingredients: "Zanahoria\nApio\nCebolla\nCalabacín\nCaldo de verduras\nFideos finos", tags: ["vegetariana", "económica"] },
  { id: "4", title: "Ensalada César", ingredients: "Lechuga romana\nPollo a la plancha\nPan tostado\nParmesano\nSalsa César", tags: ["rápida", "alta proteína"] },
  { id: "5", title: "Arroz con pollo", ingredients: "300g arroz\n400g pollo\n1 cebolla\nPimiento\nGuisantes\nAzafrán", tags: ["kid-friendly", "económica"] },
  { id: "6", title: "Huevos revueltos", ingredients: "6 huevos\nMantequilla\nSal y pimienta", tags: ["rápida", "económica"] },
  { id: "7", title: "Pizza casera", ingredients: "Masa de pizza\nTomate frito\nMozzarella\nAlbahaca\nOregano", tags: ["kid-friendly"] },
  { id: "8", title: "Pescado al horno", ingredients: "4 filetes de merluza\nLimón\nAjo\nAceite de oliva\nPerejil", tags: ["alta proteína", "sin gluten"] },
];

function saveToStorage(payload: {
  recipes: Recipe[];
  plan: PlanState;
  manualGroceryItems: { id: string; label: string }[];
  groceryCheckedIds: string[];
  themeDays: ThemeDays;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function useTableTimeData() {
  const { user, householdId, loading: authLoading, ensureHousehold } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<PlanState>({});
  const [manualGroceryItems, setManualGroceryItems] = useState<{ id: string; label: string }[]>([]);
  const [groceryCheckedIds, setGroceryCheckedIds] = useState<Set<string>>(() => new Set());
  const [themeDays, setThemeDays] = useState<ThemeDays>({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudUnavailable, setCloudUnavailable] = useState(false);
  const effectiveHouseholdId = useRef<string | null>(null);
  const [realtimeHouseholdId, setRealtimeHouseholdId] = useState<string | null>(null);

  const loadFromSupabase = useCallback(async (hid: string) => {
    const supabase = createClient();
    const [recipesRes, slotsRes, manualRes, checkedRes, themesRes] = await Promise.all([
      supabase.from("recipes").select("id, title, ingredients, instructions, tags").eq("household_id", hid),
      supabase.from("plan_slots").select("slot_key, recipe_id").eq("household_id", hid),
      supabase.from("grocery_items").select("id, label").eq("household_id", hid).eq("source", "manual"),
      supabase.from("grocery_checked").select("item_key").eq("household_id", hid),
      supabase.from("theme_days").select("day_index, meal_type, theme").eq("household_id", hid),
    ]);

    const recipes: Recipe[] = (recipesRes.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      ingredients: r.ingredients ?? undefined,
      instructions: r.instructions ?? undefined,
      tags: Array.isArray(r.tags) ? r.tags : [],
    }));

    const plan: PlanState = {};
    for (const s of slotsRes.data ?? []) {
      plan[s.slot_key] = s.recipe_id;
    }

    const manualGroceryItems = (manualRes.data ?? []).map((r) => ({ id: r.id, label: r.label }));

    const groceryCheckedIds = new Set((checkedRes.data ?? []).map((c) => c.item_key));

    const themeDays: ThemeDays = {};
    for (const t of themesRes.data ?? []) {
      const meal = t.meal_type as MealType;
      if (!themeDays[t.day_index]) themeDays[t.day_index] = {};
      themeDays[t.day_index]![meal] = t.theme;
    }

    setRecipes(recipes);
    setPlan(plan);
    setManualGroceryItems(manualGroceryItems);
    setGroceryCheckedIds(groceryCheckedIds);
    setThemeDays(themeDays);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const init = async () => {
      let hid = householdId;
      if (user && !hid) {
        hid = await ensureHousehold() ?? null;
      }

      if (hid) {
        setCloudUnavailable(false);
        effectiveHouseholdId.current = hid;
        setRealtimeHouseholdId(hid);
        await loadFromSupabase(hid);
      } else {
        setRealtimeHouseholdId(null);
        setCloudUnavailable(!!user);
        const stored = loadFromStorage();
        if (stored && (stored.recipes.length > 0 || Object.keys(stored.plan).length > 0 || stored.manualGroceryItems.length > 0)) {
          setRecipes(stored.recipes);
          setPlan(stored.plan);
          setManualGroceryItems(stored.manualGroceryItems);
          setGroceryCheckedIds(new Set(stored.groceryCheckedIds));
          setThemeDays(stored.themeDays);
        } else {
          setRecipes(INITIAL_RECIPES);
        }
      }
      setHasHydrated(true);
      setSyncLoading(false);
    };

    init();
  }, [authLoading, user, householdId, ensureHousehold, loadFromSupabase]);

  const persist = useCallback(
    async (payload: {
      recipes: Recipe[];
      plan: PlanState;
      manualGroceryItems: { id: string; label: string }[];
      groceryCheckedIds: string[];
      themeDays: ThemeDays;
    }) => {
      const hid = effectiveHouseholdId.current ?? householdId;
      if (hid) {
        setSyncError(null);
        const supabase = createClient();
        const recipeIds = new Set(payload.recipes.map((r) => r.id));
        const { error: recipesError } = await supabase.from("recipes").upsert(
          payload.recipes.map((r) => ({
            id: r.id,
            household_id: hid,
            title: r.title,
            ingredients: r.ingredients ?? null,
            instructions: r.instructions ?? null,
            tags: r.tags ?? [],
          })),
          { onConflict: "id" }
        );
        if (recipesError) {
          console.error("[TableTime] Error guardando recetas en Supabase:", recipesError);
          setSyncError(recipesError.message);
          return;
        }
        await supabase.from("plan_slots").delete().eq("household_id", hid);
        const validSlots = Object.entries(payload.plan).filter(([, recipe_id]) => recipeIds.has(recipe_id));
        if (validSlots.length > 0) {
          await supabase.from("plan_slots").insert(
            validSlots.map(([slot_key, recipe_id]) => ({ household_id: hid, slot_key, recipe_id }))
          );
        }
        const existingManual = await supabase.from("grocery_items").select("id").eq("household_id", hid).eq("source", "manual");
        const existingIds = new Set((existingManual.data ?? []).map((r) => r.id));
        for (const m of payload.manualGroceryItems) {
          if (existingIds.has(m.id)) {
            await supabase.from("grocery_items").update({ label: m.label }).eq("id", m.id);
          } else {
            await supabase.from("grocery_items").insert({
              id: m.id,
              household_id: hid,
              label: m.label,
              source: "manual",
              checked: false,
            });
          }
        }
        const toDelete = [...existingIds].filter((id) => !payload.manualGroceryItems.some((m) => m.id === id));
        if (toDelete.length > 0) {
          await supabase.from("grocery_items").delete().in("id", toDelete);
        }
        await supabase.from("grocery_checked").delete().eq("household_id", hid);
        if (payload.groceryCheckedIds.length > 0) {
          await supabase.from("grocery_checked").insert(
            payload.groceryCheckedIds.map((item_key) => ({ household_id: hid, item_key }))
          );
        }
        await supabase.from("theme_days").delete().eq("household_id", hid);
        const themeRows: { household_id: string; day_index: number; meal_type: string; theme: string }[] = [];
        for (const [dayStr, dayThemes] of Object.entries(payload.themeDays)) {
          const dayIndex = parseInt(dayStr, 10);
          if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) continue;
          for (const [meal, theme] of Object.entries(dayThemes ?? {})) {
            if (theme && MEAL_TYPES.includes(meal as MealType)) {
              themeRows.push({ household_id: hid, day_index: dayIndex, meal_type: meal, theme });
            }
          }
        }
        if (themeRows.length > 0) {
          await supabase.from("theme_days").insert(themeRows);
        }
      } else {
        saveToStorage(payload);
      }
    },
    [householdId]
  );

  useEffect(() => {
    if (!hasHydrated || syncLoading) return;
    const payload = {
      recipes,
      plan,
      manualGroceryItems,
      groceryCheckedIds: [...groceryCheckedIds],
      themeDays,
    };
    const timer = setTimeout(() => persist(payload), 500);
    return () => clearTimeout(timer);
  }, [hasHydrated, syncLoading, recipes, plan, manualGroceryItems, groceryCheckedIds, themeDays, persist]);

  const hid = realtimeHouseholdId ?? effectiveHouseholdId.current ?? householdId;

  useEffect(() => {
    if (!hid) return;
    const supabase = createClient();
    const channelName = `household:${hid}`;

    const handleGroceryCheckedInsert = (payload: { new: { item_key: string } }) => {
      setGroceryCheckedIds((prev) => new Set([...prev, payload.new.item_key]));
    };
    const handleGroceryCheckedDelete = (payload: { old: { household_id: string; item_key: string } }) => {
      if (payload.old.household_id === hid) {
        setGroceryCheckedIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.old.item_key);
          return next;
        });
      }
    };
    const handleGroceryItemsInsert = (payload: { new: { id: string; label: string; source: string } }) => {
      if (payload.new.source === "manual") {
        setManualGroceryItems((prev) => [...prev, { id: payload.new.id, label: payload.new.label }]);
      }
    };
    const handleGroceryItemsUpdate = (payload: { new: { id: string; label: string; source: string } }) => {
      if (payload.new.source === "manual") {
        setManualGroceryItems((prev) =>
          prev.map((i) => (i.id === payload.new.id ? { ...i, label: payload.new.label } : i))
        );
      }
    };
    const handleGroceryItemsDelete = (payload: { old: { household_id: string; id: string; source: string } }) => {
      if (payload.old.household_id === hid && payload.old.source === "manual") {
        setManualGroceryItems((prev) => prev.filter((i) => i.id !== payload.old.id));
      }
    };

    const handleRecipesInsert = (payload: { new: { id: string; title: string; ingredients: string | null; instructions: string | null; tags: string[] } }) => {
      setRecipes((prev) => {
        if (prev.some((r) => r.id === payload.new.id)) return prev;
        return [...prev, {
          id: payload.new.id,
          title: payload.new.title,
          ingredients: payload.new.ingredients ?? undefined,
          instructions: payload.new.instructions ?? undefined,
          tags: Array.isArray(payload.new.tags) ? payload.new.tags : [],
        }];
      });
    };
    const handleRecipesUpdate = (payload: { new: { id: string; title: string; ingredients: string | null; instructions: string | null; tags: string[] } }) => {
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === payload.new.id
            ? {
                id: payload.new.id,
                title: payload.new.title,
                ingredients: payload.new.ingredients ?? undefined,
                instructions: payload.new.instructions ?? undefined,
                tags: Array.isArray(payload.new.tags) ? payload.new.tags : [],
              }
            : r
        )
      );
    };
    const handleRecipesDelete = (payload: { old: { household_id: string; id: string } }) => {
      if (payload.old.household_id === hid) {
        setRecipes((prev) => prev.filter((r) => r.id !== payload.old.id));
        setPlan((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k] === payload.old.id) delete next[k];
          }
          return next;
        });
      }
    };

    const handlePlanSlotsInsert = (payload: { new: { household_id: string; slot_key: string; recipe_id: string } }) => {
      if (payload.new.household_id === hid) {
        setPlan((prev) => ({ ...prev, [payload.new.slot_key]: payload.new.recipe_id }));
      }
    };
    const handlePlanSlotsUpdate = (payload: { new: { household_id: string; slot_key: string; recipe_id: string } }) => {
      if (payload.new.household_id === hid) {
        setPlan((prev) => ({ ...prev, [payload.new.slot_key]: payload.new.recipe_id }));
      }
    };
    const handlePlanSlotsDelete = (payload: { old: { household_id: string; slot_key: string } }) => {
      if (payload.old.household_id === hid) {
        setPlan((prev) => {
          const next = { ...prev };
          delete next[payload.old.slot_key];
          return next;
        });
      }
    };

    const handleThemeDaysInsert = (payload: { new: { household_id: string; day_index: number; meal_type: string; theme: string } }) => {
      if (payload.new.household_id === hid && MEAL_TYPES.includes(payload.new.meal_type as MealType)) {
        setThemeDays((prev) => ({
          ...prev,
          [payload.new.day_index]: {
            ...prev[payload.new.day_index],
            [payload.new.meal_type]: payload.new.theme,
          },
        }));
      }
    };
    const handleThemeDaysDelete = (payload: { old: { household_id: string; day_index: number; meal_type: string } }) => {
      if (payload.old.household_id === hid) {
        setThemeDays((prev) => {
          const next = { ...prev };
          const day = next[payload.old.day_index];
          if (day) {
            const newDay = { ...day };
            delete newDay[payload.old.meal_type as MealType];
            if (Object.keys(newDay).length === 0) delete next[payload.old.day_index];
            else next[payload.old.day_index] = newDay;
          }
          return next;
        });
      }
    };

    // Cast to any to avoid TS overload resolution with chained .on('postgres_changes', ...)
    const channel = supabase.channel(channelName) as any;

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "grocery_checked", filter: `household_id=eq.${hid}` },
        handleGroceryCheckedInsert
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "grocery_checked" },
        handleGroceryCheckedDelete
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "grocery_items", filter: `household_id=eq.${hid}` },
        handleGroceryItemsInsert
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "grocery_items", filter: `household_id=eq.${hid}` },
        handleGroceryItemsUpdate
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "grocery_items" },
        handleGroceryItemsDelete
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "recipes", filter: `household_id=eq.${hid}` },
        handleRecipesInsert
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "recipes", filter: `household_id=eq.${hid}` },
        handleRecipesUpdate
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "recipes" },
        handleRecipesDelete
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plan_slots", filter: `household_id=eq.${hid}` },
        handlePlanSlotsInsert
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plan_slots", filter: `household_id=eq.${hid}` },
        handlePlanSlotsUpdate
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "plan_slots" },
        handlePlanSlotsDelete
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "theme_days", filter: `household_id=eq.${hid}` },
        handleThemeDaysInsert
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "theme_days" },
        handleThemeDaysDelete
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel as RealtimeChannel);
    };
  }, [hid]);

  const addRecipe = useCallback((title: string, ingredients?: string, instructions?: string, tags?: string[]) => {
    const id = (effectiveHouseholdId.current ?? householdId) ? crypto.randomUUID() : `u-${Date.now()}`;
    setRecipes((prev) => [...prev, { id, title, ingredients, instructions, tags }]);
  }, [householdId]);

  const addManualGroceryItem = useCallback((label: string) => {
    const id = (effectiveHouseholdId.current ?? householdId) ? crypto.randomUUID() : `m-${Date.now()}`;
    setManualGroceryItems((prev) => [...prev, { id, label }]);
  }, [householdId]);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setPlan((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === id) delete next[k];
        }
      return next;
    });
  }, []);

  return {
    recipes,
    setRecipes,
    plan,
    setPlan,
    manualGroceryItems,
    setManualGroceryItems,
    groceryCheckedIds,
    setGroceryCheckedIds,
    themeDays,
    setThemeDays,
    addRecipe,
    addManualGroceryItem,
    updateRecipe,
    removeRecipe,
    hasHydrated,
    syncLoading,
    isRemote: !!effectiveHouseholdId.current || !!householdId,
    syncError,
    cloudUnavailable,
  };
}
