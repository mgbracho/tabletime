import type { Recipe, PlanState } from "@/lib/sync/use-tabletime-data";
import { isSlotStatus, MEAL_LABELS } from "@/lib/constants";
import { slotKey, getWeekDates } from "@/lib/utils/calendar";

export type GroceryItem = { id: string; label: string; fromPlan: boolean };

export const GROCERY_CATEGORIES = [
  {
    key: "vegetables",
    label: "Verduras y frutas",
    keywords: [
      "lechuga", "tomate", "cebolla", "zanahoria", "ajo", "pimiento", "calabacín",
      "berenjena", "espinaca", "brócoli", "limón", "manzana", "plátano", "naranja",
      "pera", "uva", "fresa", "patata", "boniato", "apio", "pepino", "aguacate",
      "albahaca", "perejil", "cebollino",
    ],
  },
  {
    key: "dairy",
    label: "Lácteos",
    keywords: ["leche", "yogur", "queso", "mantequilla", "nata", "crema", "mozzarella", "parmesano", "ricotta"],
  },
  {
    key: "meat",
    label: "Carne y pescado",
    keywords: [
      "pollo", "carne", "ternera", "cerdo", "pescado", "merluza", "salmón",
      "atún", "bacalao", "jamón", "bacon", "pechuga", "muslo",
    ],
  },
  {
    key: "pantry",
    label: "Despensa",
    keywords: [
      "aceite", "sal", "pimienta", "arroz", "pasta", "harina", "azúcar", "vinagre",
      "salsa", "tomate triturado", "caldo", "legumbres", "lentejas", "garbanzos",
      "alubias", "pan", "tortilla", "cereal", "miel", "mostaza", "mayonesa",
      "aceituna", "almendra", "nuez",
    ],
  },
] as const;

export function getGroceryCategory(label: string): string {
  const lower = label.toLowerCase();
  for (const cat of GROCERY_CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat.key;
  }
  return "other";
}

export function normalizeIngredientForGrouping(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();
  const match = s.match(
    /^(\d+([.,]\d+)?\s*(g|kg|ml|l|oz|lb|cups?|tbsp|tsp|dientes?|unidades?|bote|cucharada|cucharadita)?\s*[-–]?\s*)?(.+)$/
  );
  return match ? match[4].trim() : s;
}

export function parseCountFromLabel(label: string): { baseLabel: string; count: number } {
  const m = label.match(/\s*\((\d+)\)\s*$/);
  if (m) {
    return { baseLabel: label.replace(/\s*\(\d+\)\s*$/, "").trim(), count: parseInt(m[1], 10) };
  }
  return { baseLabel: label, count: 1 };
}

export function mergeGroceryItems(items: GroceryItem[]): GroceryItem[] {
  const byKey = new Map<string, { label: string; count: number; fromPlan: boolean }>();
  for (const item of items) {
    const { baseLabel, count: itemCount } = parseCountFromLabel(item.label);
    const key = normalizeIngredientForGrouping(baseLabel);
    const existing = byKey.get(key);
    if (existing) {
      existing.count += itemCount;
      if (baseLabel.length > existing.label.length) existing.label = baseLabel;
      existing.fromPlan = existing.fromPlan || item.fromPlan;
    } else {
      byKey.set(key, { label: baseLabel, count: itemCount, fromPlan: item.fromPlan });
    }
  }
  return Array.from(byKey.entries()).map(([key, { label, count, fromPlan }]) => ({
    id: `merged-${key.replace(/\s+/g, "-")}`,
    label: count > 1 ? `${label} (${count})` : label,
    fromPlan,
  }));
}

export function getGroceryItemsFromPlan(
  plan: PlanState,
  recipes: Recipe[],
  weekStart: Date,
  visibleMeals: readonly string[] = MEAL_LABELS
): GroceryItem[] {
  const weekDays = getWeekDates(weekStart);
  const items: GroceryItem[] = [];
  for (const meal of visibleMeals) {
    for (const d of weekDays) {
      const key = slotKey(d.date, meal);
      const recipeId = plan[key];
      if (!recipeId || isSlotStatus(recipeId)) continue;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe?.ingredients) continue;
      recipe.ingredients
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((line) => {
          items.push({ id: `plan-${key}-${line}`, label: line, fromPlan: true });
        });
    }
  }
  return mergeGroceryItems(items);
}
