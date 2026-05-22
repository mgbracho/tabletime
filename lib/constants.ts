export const TABS = [
  { id: "calendar", label: "Calendario" },
  { id: "recipes", label: "Recetas" },
  { id: "grocery", label: "Compra" },
  { id: "household", label: "Hogar" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const MEAL_LABELS = ["Desayuno", "Comida", "Cena", "Snacks"] as const;
export type MealType = (typeof MEAL_LABELS)[number];

export const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const CALENDAR_VISIBLE_MEALS_KEY = "tabletime-calendar-visible-meals";

export function loadVisibleMeals(): readonly MealType[] {
  if (typeof window === "undefined") return [...MEAL_LABELS];
  try {
    const raw = localStorage.getItem(CALENDAR_VISIBLE_MEALS_KEY);
    if (!raw) return [...MEAL_LABELS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...MEAL_LABELS];
    const valid = parsed.filter((m): m is MealType =>
      typeof m === "string" && MEAL_LABELS.includes(m as MealType)
    );
    return valid.length > 0 ? valid : [...MEAL_LABELS];
  } catch {
    return [...MEAL_LABELS];
  }
}

export const SLOT_STATUS_VALUES = ["leftovers", "skip"] as const;
export type SlotStatusValue = (typeof SLOT_STATUS_VALUES)[number];
export function isSlotStatus(v: string): v is SlotStatusValue {
  return SLOT_STATUS_VALUES.includes(v as SlotStatusValue);
}
export const SLOT_STATUS_LABELS: Record<SlotStatusValue, string> = {
  leftovers: "Sobras",
  skip: "Saltar",
};

export const SUGGESTED_TAGS = [
  "kid-friendly",
  "rápida",
  "vegetariana",
  "alta proteína",
  "económica",
  "sin gluten",
] as const;

export const DIETARY_RESTRICTION_OPTIONS = [
  "sin gluten",
  "vegetariana",
  "vegano",
  "sin lactosa",
  "bajo en sodio",
  "kid-friendly",
] as const;
