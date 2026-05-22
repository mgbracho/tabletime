import type { Recipe, PlanState } from "@/lib/sync/use-tabletime-data";
import { isSlotStatus, MEAL_LABELS } from "@/lib/constants";
import { slotKey, getWeekDates } from "@/lib/utils/calendar";

export type GroceryItem = { id: string; label: string; fromPlan: boolean };

export const GROCERY_CATEGORIES = [
  {
    key: "vegetables",
    label: "Verduras y frutas",
    keywords: [
      // español
      "lechuga", "tomate", "cebolla", "zanahoria", "ajo", "pimiento", "calabacín",
      "berenjena", "espinaca", "brócoli", "limón", "manzana", "plátano", "naranja",
      "pera", "uva", "fresa", "patata", "boniato", "apio", "pepino", "aguacate",
      "albahaca", "perejil", "cebollino", "rúcula", "remolacha", "col", "coliflor",
      "champiñon", "seta", "maíz", "guisante", "judía", "alcachofa", "puerro",
      // english
      "lettuce", "tomato", "onion", "carrot", "garlic", "pepper", "zucchini",
      "eggplant", "spinach", "broccoli", "lemon", "apple", "banana", "orange",
      "pear", "grape", "strawberry", "potato", "sweet potato", "celery", "cucumber",
      "avocado", "basil", "parsley", "chive", "arugula", "beetroot", "cabbage",
      "cauliflower", "mushroom", "corn", "pea", "green bean", "artichoke", "leek",
      "lime", "mango", "pineapple", "kiwi", "cherry", "blueberry", "raspberry",
      // deutsch
      "salat", "tomate", "zwiebel", "karotte", "knoblauch", "paprika", "zucchini",
      "aubergine", "spinat", "brokkoli", "zitrone", "apfel", "banane", "orange",
      "birne", "traube", "erdbeere", "kartoffel", "süsskartoffel", "sellerie",
      "gurke", "avocado", "basilikum", "petersilie", "rucola", "rübe", "kohl",
      "blumenkohl", "pilz", "mais", "erbse", "bohne", "artischocke", "lauch",
    ],
  },
  {
    key: "dairy",
    label: "Lácteos",
    keywords: [
      // español
      "leche", "yogur", "queso", "mantequilla", "nata", "crema", "mozzarella",
      "parmesano", "ricotta", "kéfir", "feta",
      // english
      "milk", "yogurt", "cheese", "butter", "cream", "mozzarella", "parmesan",
      "ricotta", "kefir", "feta", "sour cream", "cream cheese", "cheddar",
      "brie", "gouda", "pecorino",
      // deutsch
      "milch", "joghurt", "käse", "butter", "sahne", "quark", "mozzarella",
      "parmesan", "ricotta", "kefir", "feta", "schmand", "frischkäse",
    ],
  },
  {
    key: "meat",
    label: "Carne y pescado",
    keywords: [
      // español
      "pollo", "carne", "ternera", "cerdo", "pescado", "merluza", "salmón",
      "atún", "bacalao", "jamón", "bacon", "pechuga", "muslo", "cordero",
      "pavo", "gambas", "mejillones", "calamar", "langostino",
      // english
      "chicken", "beef", "pork", "fish", "salmon", "tuna", "cod", "ham",
      "bacon", "breast", "thigh", "lamb", "turkey", "shrimp", "prawn",
      "mussel", "squid", "sausage", "mince", "ground beef",
      // deutsch
      "huhn", "hähnchen", "rindfleisch", "rind", "schwein", "schweinefleisch",
      "fisch", "lachs", "thunfisch", "kabeljau", "schinken", "speck",
      "brust", "keule", "lamm", "truthahn", "garnelen", "muschel", "tintenfisch",
      "wurst", "hackfleisch",
    ],
  },
  {
    key: "pantry",
    label: "Despensa",
    keywords: [
      // español
      "aceite", "sal", "pimienta", "arroz", "pasta", "harina", "azúcar", "vinagre",
      "salsa", "tomate triturado", "caldo", "legumbres", "lentejas", "garbanzos",
      "alubias", "pan", "tortilla", "cereal", "miel", "mostaza", "mayonesa",
      "aceituna", "almendra", "nuez", "semilla", "calabaza", "sésamo", "levadura",
      "bicarbonato", "canela", "orégano", "romero", "tomillo", "comino", "curry",
      "pimentón", "azafrán", "cacao", "chocolate", "vainilla",
      // english
      "oil", "salt", "pepper", "rice", "pasta", "flour", "sugar", "vinegar",
      "sauce", "crushed tomato", "broth", "stock", "lentil", "chickpea",
      "bean", "bread", "cereal", "honey", "mustard", "mayonnaise", "olive",
      "almond", "walnut", "seed", "pumpkin seed", "sesame", "yeast",
      "baking soda", "baking powder", "cinnamon", "oregano", "rosemary",
      "thyme", "cumin", "curry", "paprika", "saffron", "cocoa", "chocolate",
      "vanilla", "oat", "quinoa", "couscous", "noodle", "soy sauce", "tahini",
      "pesto", "peanut butter",
      // deutsch
      "öl", "salz", "pfeffer", "reis", "nudeln", "mehl", "zucker", "essig",
      "soße", "brühe", "linsen", "kichererbse", "bohnen", "brot", "haferflocken",
      "honig", "senf", "mayonnaise", "olive", "mandel", "walnuss", "samen",
      "kürbiskerne", "sesam", "hefe", "natron", "backpulver", "zimt", "oregano",
      "rosmarin", "thymian", "kreuzkümmel", "curry", "paprikapulver", "kakao",
      "schokolade", "vanille", "quinoa", "couscous", "sojasoße", "tahini",
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
