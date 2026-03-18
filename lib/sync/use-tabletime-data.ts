"use client";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

const STORAGE_KEY = "tabletime-v1";
const MEAL_TYPES = ["Desayuno", "Comida", "Cena", "Snacks"] as const;
type MealType = (typeof MEAL_TYPES)[number];

export type Recipe = {
  id: string;
  title: string;
  ingredients?: string;
  instructions?: string;
  tags?: string[];
  default_servings?: number;
  last_used_at?: string;
  is_favorite?: boolean;
  rating?: number | null;
  family_approved?: boolean;
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
  { id: "1", title: "Pasta con tomate", ingredients: "400g pasta\n1 bote tomate triturado\n2 dientes de ajo\nAceite de oliva\nAlbahaca", tags: ["rápida", "vegetariana"], default_servings: 4 },
  { id: "2", title: "Tacos de pollo", ingredients: "500g pechuga de pollo\nTortillas de maíz\nLechuga\nTomate\nQueso rallado\nCrema ácida", tags: ["kid-friendly", "alta proteína"], default_servings: 4 },
  { id: "3", title: "Sopa de verduras", ingredients: "Zanahoria\nApio\nCebolla\nCalabacín\nCaldo de verduras\nFideos finos", tags: ["vegetariana", "económica"], default_servings: 4 },
  { id: "4", title: "Ensalada César", ingredients: "Lechuga romana\nPollo a la plancha\nPan tostado\nParmesano\nSalsa César", tags: ["rápida", "alta proteína"], default_servings: 4 },
  { id: "5", title: "Arroz con pollo", ingredients: "300g arroz\n400g pollo\n1 cebolla\nPimiento\nGuisantes\nAzafrán", tags: ["kid-friendly", "económica"], default_servings: 4 },
  { id: "6", title: "Huevos revueltos", ingredients: "6 huevos\nMantequilla\nSal y pimienta", tags: ["rápida", "económica"], default_servings: 4 },
  { id: "7", title: "Pizza casera", ingredients: "Masa de pizza\nTomate frito\nMozzarella\nAlbahaca\nOregano", tags: ["kid-friendly"], default_servings: 4 },
  { id: "8", title: "Pescado al horno", ingredients: "4 filetes de merluza\nLimón\nAjo\nAceite de oliva\nPerejil", tags: ["alta proteína", "sin gluten"], default_servings: 4 },
  { id: "9", title: "Lentejas con chorizo", ingredients: "300g lentejas\n1 chorizo\n1 cebolla\n2 zanahorias\n2 dientes de ajo\nCaldo de verduras\nPimentón", tags: ["económica", "kid-friendly"], default_servings: 4 },
  { id: "10", title: "Tortilla de patatas", ingredients: "6 huevos\n4 patatas\n1 cebolla\nAceite de oliva\nSal", tags: ["rápida", "vegetariana"], default_servings: 4 },
  { id: "11", title: "Pollo al limón", ingredients: "4 muslos de pollo\n2 limones\nAjo\nRomero\nAceite de oliva\nSal y pimienta", tags: ["alta proteína", "sin gluten"], default_servings: 4 },
  { id: "12", title: "Crema de calabacín", ingredients: "2 calabacines\n1 patata\n1 cebolla\nCaldo de verduras\nNata líquida\nSal y nuez moscada", tags: ["vegetariana", "rápida"], default_servings: 4 },
  { id: "13", title: "Hamburguesas caseras", ingredients: "500g carne picada\n1 cebolla\n1 huevo\nPan rallado\n4 panecillos\nLechuga\nTomate\nQueso en lonchas", tags: ["kid-friendly", "alta proteína"], default_servings: 4 },
  { id: "14", title: "Paella de marisco", ingredients: "300g arroz\n200g gambas\n200g mejillones\n1 calamar\n1 pimiento rojo\nAzafrán\nGuisantes\nAceite de oliva", tags: ["alta proteína"], default_servings: 4 },
  { id: "15", title: "Ensalada de quinoa", ingredients: "200g quinoa\n1 aguacate\n1 pepino\nTomate cherry\nLima\nAceite de oliva\nPerejil", tags: ["vegetariana", "rápida", "sin gluten"], default_servings: 4 },
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
  const { user, householdId, loading: authLoading, ensureHousehold, ensureError } = useAuth();
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
  const ignoreThemeDaysRealtimeUntil = useRef<number>(0);
  const ignorePlanSlotsRealtimeUntil = useRef<number>(0);
  const ignoreGroceryCheckedRealtimeUntil = useRef<number>(0);
  const lastPersistSignature = useRef<string>("");

  const signatureForPersist = useCallback((payload: {
    recipes: Recipe[];
    plan: PlanState;
    manualGroceryItems: { id: string; label: string }[];
    groceryCheckedIds: string[];
    themeDays: ThemeDays;
  }) => {
    const recipesSig = [...payload.recipes]
      .map((r) => ({
        id: r.id,
        title: r.title ?? "",
        ingredients: r.ingredients ?? "",
        instructions: r.instructions ?? "",
        tags: Array.isArray(r.tags) ? [...r.tags].sort() : [],
        default_servings: r.default_servings ?? 0,
        is_favorite: r.is_favorite === true,
        rating: r.rating ?? null,
        family_approved: r.family_approved === true,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const planSig = Object.entries(payload.plan)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v]);

    const manualSig = [...payload.manualGroceryItems]
      .map((m) => ({ id: m.id, label: m.label ?? "" }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const checkedSig = [...payload.groceryCheckedIds].sort();

    const themeSig = Object.entries(payload.themeDays)
      .map(([dayStr, meals]) => {
        const dayIndex = parseInt(dayStr, 10);
        const entries = Object.entries(meals ?? {})
          .filter(([, t]) => typeof t === "string" && t.trim().length > 0)
          .sort(([a], [b]) => a.localeCompare(b));
        return [dayIndex, entries];
      })
      .sort(([a], [b]) => (a as number) - (b as number));

    return JSON.stringify([recipesSig, planSig, manualSig, checkedSig, themeSig]);
  }, []);

  const loadFromSupabase = useCallback(async (hid: string): Promise<{
    recipes: Recipe[];
    plan: PlanState;
    manualGroceryItems: { id: string; label: string }[];
    groceryCheckedIds: string[];
    themeDays: ThemeDays;
  } | null> => {
    const supabase = createClient();
    const [recipesRes, slotsRes, manualRes, checkedRes, themesRes] = await Promise.all([
      supabase.from("recipes").select("id, title, ingredients, instructions, tags, default_servings, is_favorite, rating, family_approved").eq("household_id", hid),
      supabase.from("plan_slots").select("slot_key, recipe_id, slot_status").eq("household_id", hid),
      supabase.from("grocery_items").select("id, label").eq("household_id", hid).eq("source", "manual"),
      supabase.from("grocery_checked").select("item_key").eq("household_id", hid),
      supabase.from("theme_days").select("day_index, meal_type, theme").eq("household_id", hid),
    ]);

    const stored = loadFromStorage();

    let recipes: Recipe[] = (recipesRes.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      ingredients: r.ingredients ?? undefined,
      instructions: r.instructions ?? undefined,
      tags: Array.isArray(r.tags) ? r.tags : [],
      default_servings: typeof r.default_servings === "number" ? r.default_servings : undefined,
      is_favorite: r.is_favorite === true,
      rating: typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? r.rating : undefined,
      family_approved: r.family_approved === true,
    }));

    const plan: PlanState = {};
    for (const s of slotsRes.data ?? []) {
      if (s.slot_status && s.slot_status !== "recipe") {
        plan[s.slot_key] = s.slot_status;
      } else if (s.recipe_id) {
        plan[s.slot_key] = s.recipe_id;
      }
    }

    let manualGroceryItems = (manualRes.data ?? []).map((r) => ({ id: r.id, label: r.label }));

    let groceryCheckedIds = new Set((checkedRes.data ?? []).map((c) => c.item_key));

    const themeDays: ThemeDays = {};
    for (const t of themesRes.data ?? []) {
      const meal = t.meal_type as MealType;
      if (!themeDays[t.day_index]) themeDays[t.day_index] = {};
      themeDays[t.day_index]![meal] = t.theme;
    }
    if (Object.keys(themeDays).length === 0 && stored && Object.keys(stored.themeDays).length > 0) {
      for (const [dayStr, dayThemes] of Object.entries(stored.themeDays)) {
        const d = parseInt(dayStr, 10);
        if (!isNaN(d) && d >= 0 && d <= 6 && dayThemes && typeof dayThemes === "object") {
          themeDays[d] = { ...dayThemes };
        }
      }
    }

    // Si la nube está vacía y hay datos en localStorage, fusionar para no perder el plan/recetas locales
    const remotePlanEmpty = Object.keys(plan).length === 0;
    const remoteRecipesEmpty = recipes.length === 0;
    const hasLocalData = stored && (
      Object.keys(stored.plan).length > 0 ||
      stored.recipes.length > 0 ||
      stored.manualGroceryItems.length > 0 ||
      stored.groceryCheckedIds.length > 0 ||
      Object.keys(stored.themeDays).length > 0
    );
    const shouldMerge = hasLocalData && (remotePlanEmpty || remoteRecipesEmpty);

    if (shouldMerge && stored) {
      const mergedPlan = { ...plan, ...stored.plan };
      const remoteRecipeIds = new Set(recipes.map((r) => r.id));
      const mergedRecipes =
        recipes.length > 0
          ? [...recipes, ...stored.recipes.filter((r) => !remoteRecipeIds.has(r.id))]
          : stored.recipes.length > 0
            ? stored.recipes
            : INITIAL_RECIPES.map((r) => ({ ...r, id: crypto.randomUUID() }));
      const remoteManualIds = new Set(manualGroceryItems.map((m) => m.id));
      const mergedManual = [
        ...manualGroceryItems,
        ...stored.manualGroceryItems.filter((m) => !remoteManualIds.has(m.id)),
      ];
      const mergedChecked = new Set([...groceryCheckedIds, ...stored.groceryCheckedIds]);
      const mergedThemeDays: ThemeDays = { ...themeDays };
      for (const [dayStr, dayThemes] of Object.entries(stored.themeDays)) {
        const d = parseInt(dayStr, 10);
        if (!isNaN(d) && d >= 0 && d <= 6 && dayThemes && typeof dayThemes === "object") {
          mergedThemeDays[d] = { ...mergedThemeDays[d], ...dayThemes };
        }
      }

      const mergedPayload = {
        recipes: mergedRecipes,
        plan: mergedPlan,
        manualGroceryItems: mergedManual,
        groceryCheckedIds: [...mergedChecked],
        themeDays: mergedThemeDays,
      };
      setRecipes(mergedPayload.recipes);
      setPlan(mergedPayload.plan);
      setManualGroceryItems(mergedPayload.manualGroceryItems);
      setGroceryCheckedIds(mergedChecked);
      setThemeDays(mergedPayload.themeDays);
      saveToStorage(mergedPayload);
      return mergedPayload;
    }

    setRecipes(
      recipes.length === 0
        ? INITIAL_RECIPES.map((r) => ({ ...r, id: crypto.randomUUID() }))
        : recipes
    );
    setPlan(plan);
    setManualGroceryItems(manualGroceryItems);
    setGroceryCheckedIds(groceryCheckedIds);
    setThemeDays(themeDays);
    return null;
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
        const mergedPayload = await loadFromSupabase(hid);
        if (mergedPayload) {
          await persist(mergedPayload);
        }
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

        const signature = signatureForPersist(payload);
        if (signature === lastPersistSignature.current) {
          return;
        }
        lastPersistSignature.current = signature;

        const slotStatuses = ["leftovers", "skip", "eating_out"] as const;
        const recipeIds = new Set(payload.recipes.map((r) => r.id));
        const { error: recipesError } = await supabase.from("recipes").upsert(
          payload.recipes.map((r) => ({
            id: r.id,
            household_id: hid,
            title: r.title,
            ingredients: r.ingredients ?? null,
            instructions: r.instructions ?? null,
            tags: r.tags ?? [],
            default_servings: r.default_servings ?? 4,
            is_favorite: r.is_favorite === true,
            rating: typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? r.rating : null,
            family_approved: r.family_approved === true,
          })),
          { onConflict: "id" }
        );
        if (recipesError) {
          console.error("[TableTime] Error guardando recetas en Supabase:", recipesError);
          setSyncError(recipesError.message);
          return;
        }
        const { data: existingRecipes } = await supabase.from("recipes").select("id").eq("household_id", hid);
        const idsToDelete = (existingRecipes ?? []).map((r) => r.id).filter((id) => !recipeIds.has(id));
        if (idsToDelete.length > 0) {
          await supabase.from("recipes").delete().in("id", idsToDelete);
        }

        // plan_slots: sync incremental (no full delete/insert)
        const planEntries = Object.entries(payload.plan);
        const desiredSlots = planEntries
          .map(([slot_key, value]) => {
            const isStatus = slotStatuses.includes(value as (typeof slotStatuses)[number]);
            return {
              household_id: hid,
              slot_key,
              slot_status: isStatus ? value : "recipe",
              recipe_id: isStatus ? null : (recipeIds.has(value) ? value : null),
            };
          })
          .filter((s) => s.slot_status !== "recipe" || s.recipe_id != null);

        const { data: existingSlots } = await supabase
          .from("plan_slots")
          .select("slot_key")
          .eq("household_id", hid);
        const existingSlotKeys = new Set((existingSlots ?? []).map((s) => s.slot_key));
        const desiredSlotKeys = new Set(desiredSlots.map((s) => s.slot_key));

        const slotKeysToDelete = [...existingSlotKeys].filter((k) => !desiredSlotKeys.has(k));
        ignorePlanSlotsRealtimeUntil.current = Date.now() + 2000;
        if (slotKeysToDelete.length > 0) {
          await supabase.from("plan_slots").delete().eq("household_id", hid).in("slot_key", slotKeysToDelete);
        }
        if (desiredSlots.length > 0) {
          await supabase.from("plan_slots").upsert(desiredSlots, { onConflict: "household_id,slot_key" });
        }

        // grocery_items (manual): upsert + delete diff
        const { data: existingManual } = await supabase
          .from("grocery_items")
          .select("id")
          .eq("household_id", hid)
          .eq("source", "manual");
        const existingManualIds = new Set((existingManual ?? []).map((r) => r.id));
        const desiredManualIds = new Set(payload.manualGroceryItems.map((m) => m.id));
        const manualIdsToDelete = [...existingManualIds].filter((id) => !desiredManualIds.has(id));
        if (manualIdsToDelete.length > 0) {
          await supabase.from("grocery_items").delete().eq("household_id", hid).in("id", manualIdsToDelete);
        }
        if (payload.manualGroceryItems.length > 0) {
          await supabase.from("grocery_items").upsert(
            payload.manualGroceryItems.map((m) => ({
              id: m.id,
              household_id: hid,
              label: m.label,
              source: "manual",
              checked: false,
            })),
            { onConflict: "id" }
          );
        }

        // grocery_checked: insert/delete diff (no full delete)
        const { data: existingChecked } = await supabase
          .from("grocery_checked")
          .select("item_key")
          .eq("household_id", hid);
        const existingCheckedSet = new Set((existingChecked ?? []).map((c) => c.item_key));
        const desiredCheckedSet = new Set(payload.groceryCheckedIds);
        const checkedToInsert = [...desiredCheckedSet].filter((k) => !existingCheckedSet.has(k));
        const checkedToDelete = [...existingCheckedSet].filter((k) => !desiredCheckedSet.has(k));
        ignoreGroceryCheckedRealtimeUntil.current = Date.now() + 2000;
        if (checkedToDelete.length > 0) {
          await supabase.from("grocery_checked").delete().eq("household_id", hid).in("item_key", checkedToDelete);
        }
        if (checkedToInsert.length > 0) {
          await supabase.from("grocery_checked").insert(checkedToInsert.map((item_key) => ({ household_id: hid, item_key })));
        }

        // theme_days: upsert + delete diff (no full delete)
        const desiredThemeRows: { household_id: string; day_index: number; meal_type: string; theme: string }[] = [];
        for (const [dayStr, dayThemes] of Object.entries(payload.themeDays)) {
          const dayIndex = parseInt(dayStr, 10);
          if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) continue;
          for (const [meal, theme] of Object.entries(dayThemes ?? {})) {
            const t = typeof theme === "string" ? theme.trim() : "";
            if (t && MEAL_TYPES.includes(meal as MealType)) {
              desiredThemeRows.push({ household_id: hid, day_index: dayIndex, meal_type: meal, theme: t });
            }
          }
        }
        const { data: existingThemes } = await supabase
          .from("theme_days")
          .select("day_index, meal_type")
          .eq("household_id", hid);
        const existingThemeKeys = new Set((existingThemes ?? []).map((t) => `${t.day_index}:${t.meal_type}`));
        const desiredThemeKeys = new Set(desiredThemeRows.map((t) => `${t.day_index}:${t.meal_type}`));
        const themeKeysToDelete = [...existingThemeKeys].filter((k) => !desiredThemeKeys.has(k));
        ignoreThemeDaysRealtimeUntil.current = Date.now() + 2000;
        for (const key of themeKeysToDelete) {
          const [dayStr, mealType] = key.split(":");
          const day_index = parseInt(dayStr, 10);
          if (!isNaN(day_index) && mealType) {
            await supabase
              .from("theme_days")
              .delete()
              .eq("household_id", hid)
              .eq("day_index", day_index)
              .eq("meal_type", mealType);
          }
        }
        if (desiredThemeRows.length > 0) {
          await supabase.from("theme_days").upsert(desiredThemeRows, { onConflict: "household_id,day_index,meal_type" });
        }

        saveToStorage(payload);
      } else {
        saveToStorage(payload);
      }
    },
    [householdId, signatureForPersist]
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
      if (Date.now() < ignoreGroceryCheckedRealtimeUntil.current) return;
      setGroceryCheckedIds((prev) => new Set([...prev, payload.new.item_key]));
    };
    const handleGroceryCheckedDelete = (payload: { old: { household_id: string; item_key: string } }) => {
      if (Date.now() < ignoreGroceryCheckedRealtimeUntil.current) return;
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

    const handleRecipesInsert = (payload: { new: { id: string; title: string; ingredients: string | null; instructions: string | null; tags: string[]; default_servings?: number; is_favorite?: boolean; rating?: number | null; family_approved?: boolean } }) => {
      setRecipes((prev) => {
        if (prev.some((r) => r.id === payload.new.id)) return prev;
        return [...prev, {
          id: payload.new.id,
          title: payload.new.title,
          ingredients: payload.new.ingredients ?? undefined,
          instructions: payload.new.instructions ?? undefined,
          tags: Array.isArray(payload.new.tags) ? payload.new.tags : [],
          default_servings: payload.new.default_servings,
          is_favorite: payload.new.is_favorite === true,
          rating: typeof payload.new.rating === "number" && payload.new.rating >= 1 && payload.new.rating <= 5 ? payload.new.rating : undefined,
          family_approved: payload.new.family_approved === true,
        }];
      });
    };
    const handleRecipesUpdate = (payload: { new: { id: string; title: string; ingredients: string | null; instructions: string | null; tags: string[]; default_servings?: number; is_favorite?: boolean; rating?: number | null; family_approved?: boolean } }) => {
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === payload.new.id
            ? {
                id: payload.new.id,
                title: payload.new.title,
                ingredients: payload.new.ingredients ?? undefined,
                instructions: payload.new.instructions ?? undefined,
                tags: Array.isArray(payload.new.tags) ? payload.new.tags : [],
                default_servings: payload.new.default_servings,
                is_favorite: payload.new.is_favorite === true,
                rating: typeof payload.new.rating === "number" && payload.new.rating >= 1 && payload.new.rating <= 5 ? payload.new.rating : undefined,
                family_approved: payload.new.family_approved === true,
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

    const handlePlanSlotsInsert = (payload: { new: { household_id: string; slot_key: string; recipe_id: string | null; slot_status?: string } }) => {
      if (Date.now() < ignorePlanSlotsRealtimeUntil.current) return;
      if (payload.new.household_id === hid) {
        const value = payload.new.slot_status && payload.new.slot_status !== "recipe"
          ? payload.new.slot_status
          : payload.new.recipe_id;
        if (value) setPlan((prev) => ({ ...prev, [payload.new.slot_key]: value }));
      }
    };
    const handlePlanSlotsUpdate = (payload: { new: { household_id: string; slot_key: string; recipe_id: string | null; slot_status?: string } }) => {
      if (Date.now() < ignorePlanSlotsRealtimeUntil.current) return;
      if (payload.new.household_id === hid) {
        const value = payload.new.slot_status && payload.new.slot_status !== "recipe"
          ? payload.new.slot_status
          : payload.new.recipe_id;
        if (value) setPlan((prev) => ({ ...prev, [payload.new.slot_key]: value }));
        else setPlan((prev) => { const next = { ...prev }; delete next[payload.new.slot_key]; return next; });
      }
    };
    const handlePlanSlotsDelete = (payload: { old: { household_id: string; slot_key: string } }) => {
      if (Date.now() < ignorePlanSlotsRealtimeUntil.current) return;
      if (payload.old.household_id === hid) {
        setPlan((prev) => {
          const next = { ...prev };
          delete next[payload.old.slot_key];
          return next;
        });
      }
    };

    const handleThemeDaysInsert = (payload: { new: { household_id: string; day_index: number; meal_type: string; theme: string } }) => {
      if (Date.now() < ignoreThemeDaysRealtimeUntil.current) return;
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
      if (Date.now() < ignoreThemeDaysRealtimeUntil.current) return;
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
        { event: "DELETE", schema: "public", table: "grocery_checked", filter: `household_id=eq.${hid}` },
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
        { event: "DELETE", schema: "public", table: "grocery_items", filter: `household_id=eq.${hid}` },
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
        { event: "DELETE", schema: "public", table: "recipes", filter: `household_id=eq.${hid}` },
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
        { event: "DELETE", schema: "public", table: "plan_slots", filter: `household_id=eq.${hid}` },
        handlePlanSlotsDelete
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "theme_days", filter: `household_id=eq.${hid}` },
        handleThemeDaysInsert
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "theme_days", filter: `household_id=eq.${hid}` },
        handleThemeDaysDelete
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel as RealtimeChannel);
    };
  }, [hid]);

  const addRecipe = useCallback((title: string, ingredients?: string, instructions?: string, tags?: string[], default_servings?: number) => {
    const id = (effectiveHouseholdId.current ?? householdId) ? crypto.randomUUID() : `u-${Date.now()}`;
    setRecipes((prev) => [...prev, { id, title, ingredients, instructions, tags, default_servings: default_servings ?? 4 }]);
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
    ensureError,
  };
}
