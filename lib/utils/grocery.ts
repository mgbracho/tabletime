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

// ─── Unicode fraction normalisation ────────────────────────────────────────
const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

function replaceUnicodeFractions(s: string): string {
  for (const [ch, rep] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.split(ch).join(rep);
  }
  return s;
}

// Unit words that sit between the numeric quantity and the ingredient name.
// Each alternative must be followed by whitespace or end-of-string so we
// don't accidentally clip ingredient names that happen to start with a unit
// prefix (e.g. "granos" should not be stripped as "gr").
// Note: "unidad(?:es)?" correctly matches "unidad", "unidade", "unidades".
const UNIT_ALTS = [
  // weight
  "gramos?", "kilogramos?", "kg", "mg", "g(?=[\\s])",
  // volume
  "mililitros?", "ml", "cl", "dl", "litros?", "l(?=[\\s])",
  "oz", "libras?",
  // generic count
  "unidad(?:es)?", "unid\\.", "ud\\.", "units?", "pieces?", "st[üu]ck",
  // ES measure words
  "tazas?", "cucharadas?(?:\\s*soperas?)?", "cucharaditas?",
  "dientes?", "latas?", "botes?", "paquetes?",
  "pu[nñ]ados?", "rebanadas?", "rodajas?", "trozos?",
  "manojos?", "ramas?", "pizcas?", "pellizcos?",
  // EN measure words
  "cups?", "tbsp\\.?", "tsp\\.?", "tablespoons?", "teaspoons?",
  "cloves?", "slices?", "cans?", "jars?", "bunches?",
  "sprigs?", "handfuls?", "pinch(?:es)?", "fillets?",
  // DE measure words
  "EL\\.?", "TL\\.?", "Msp\\.?", "Prise",
].join("|");

// Require the unit word to be followed by a space or end-of-string so that
// "granola" (starts with 'gr') or "unidad" + another letter is safe.
const UNIT_WORD_RE = new RegExp(`^(${UNIT_ALTS})(?=[\\s]|$)`, "i");

// ─── Core normalisation ────────────────────────────────────────────────────

/**
 * Reduce an ingredient label to a plain lowercase key suitable for grouping.
 *
 * Pipeline:
 *  1. Replace Unicode fractions (½ → 1/2).
 *  2. Remove trailing recipe-count suffix "(N)".
 *  3. Remove ALL parenthetical notes: "(picados)", "(480 ml)", "(es)", …
 *  4. Strip leading numeric quantity (int / decimal / fraction / range).
 *  5. If a number was found, strip leading unit word(s) in a loop.
 *  6. Strip "de / del / de la / de los" connectors.
 *  7. Strip "para …" usage qualifiers.
 *  8. Lowercase + normalise diacritics.
 */
export function normalizeIngredientForGrouping(label: string): string {
  let s = replaceUnicodeFractions(label.trim());

  // 2. Remove trailing recipe-count suffix, e.g. "(4)"
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();

  // 3. Remove ALL parenthetical notes, e.g. "(picados)", "(480 ml)", "(es)"
  s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();

  // 4. Strip leading numeric quantity: integer, decimal, fraction, or range
  let hadNumber = false;
  s = s.replace(/^\d+([.,]\d+)?(\s*[-–]\s*\d+([.,]\d+)?)?(\s*\/\s*\d+)?\s*/, (m) => {
    hadNumber = m.length > 0;
    return "";
  });
  s = s.trim();

  // 5. Strip leading unit word(s) — only when a number was found
  if (hadNumber) {
    let prev = "";
    while (prev !== s) {
      prev = s;
      s = s.replace(UNIT_WORD_RE, "").trim();
    }
  }

  // 6. Strip "de / del / de la / de los / de las / de el" connector at start
  s = s.replace(/^de\s+(la\s+|los\s+|las\s+|el\s+)?/i, "").trim();
  s = s.replace(/^del\s+/i, "").trim();

  // 7. Strip trailing usage qualifier: "para la salsa", "para el aderezo", …
  s = s.replace(/\s+para\s+.*/i, "").trim();

  // 8. Lowercase + normalise diacritics
  s = s.toLowerCase()
    .replace(/[áàâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ß/g, "ss")
    .replace(/ç/g, "c");

  return s.trim() || label.trim().toLowerCase();
}

// ─── Clean label for display ───────────────────────────────────────────────

/**
 * Remove parenthetical notes and "para …" qualifiers from a label so the
 * displayed ingredient name is clean. Keeps the leading quantity+unit.
 */
function cleanDisplayLabel(label: string): string {
  let s = label.trim();
  // Remove ALL parenthetical notes
  s = s.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  // Remove "para …" usage qualifier
  s = s.replace(/\s+para\s+.*/i, "").trim();
  return s;
}

// ─── Merge helpers ─────────────────────────────────────────────────────────

export function parseCountFromLabel(label: string): { baseLabel: string; count: number } {
  const m = label.match(/\s*\((\d+)\)\s*$/);
  if (m) {
    return { baseLabel: label.replace(/\s*\(\d+\)\s*$/, "").trim(), count: parseInt(m[1], 10) };
  }
  return { baseLabel: label, count: 1 };
}

/**
 * Parse a numeric quantity string (integer, decimal with . or ,, simple fraction).
 * Returns null when unparseable.
 */
function parseQtyString(s: string): number | null {
  const clean = s.replace(",", ".").trim();
  if (!clean) return null;
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length !== 2) return null;
    const a = parseFloat(parts[0].trim());
    const b = parseFloat(parts[1].trim());
    if (isNaN(a) || isNaN(b) || b === 0) return null;
    return a / b;
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/** Format a quantity number for display: integers as whole numbers, decimals up to 2 places. */
function formatQty(n: number): string {
  // Round first to handle floating-point imprecision (e.g. 1/3 * 3 ≈ 1.0)
  const rounded = Math.round(n * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return parseFloat(rounded.toFixed(2)).toString();
}

export function mergeGroceryItems(items: GroceryItem[]): GroceryItem[] {
  type Merged = {
    label: string;        // cleaned display label (shorter preferred)
    sumQty: number | null; // running sum of leading numeric quantities; null = can't sum
    qtyRest: string;       // unit + ingredient part after the leading number
    count: number;         // number of recipe-slot occurrences
    fromPlan: boolean;
  };

  const byKey = new Map<string, Merged>();

  for (const item of items) {
    const { baseLabel } = parseCountFromLabel(item.label);
    const cleanedLabel = cleanDisplayLabel(baseLabel);
    const key = normalizeIngredientForGrouping(baseLabel);

    // Attempt to parse the leading numeric quantity from the cleaned label.
    // Apply unicode-fraction normalisation first so "½" is treated as "1/2".
    const labelForQty = replaceUnicodeFractions(cleanedLabel);
    // Match an integer / decimal / simple-fraction token at the start.
    // Reject range tokens (e.g. "2-3") so we don't mangle them.
    const qtyMatch = labelForQty.match(/^([\d.,\/]+)\s*/);
    let parsedQty: number | null = null;
    let qtyRest = labelForQty; // default: full label (unicode-replaced)
    if (qtyMatch && !/[-–]/.test(qtyMatch[1])) {
      parsedQty = parseQtyString(qtyMatch[1]);
      qtyRest = labelForQty.slice(qtyMatch[0].length);
    }

    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      // Sum quantities only when both sides are numeric and the unit+name part matches.
      if (parsedQty !== null && existing.sumQty !== null && existing.qtyRest === qtyRest) {
        existing.sumQty += parsedQty;
      } else {
        existing.sumQty = null; // mixed units or non-numeric → fall back to (×N)
      }
      if (cleanedLabel.length < existing.label.length) existing.label = cleanedLabel;
      existing.fromPlan = existing.fromPlan || item.fromPlan;
    } else {
      byKey.set(key, { label: cleanedLabel, sumQty: parsedQty, qtyRest, count: 1, fromPlan: item.fromPlan });
    }
  }

  return Array.from(byKey.entries()).map(([key, { label, sumQty, qtyRest, count, fromPlan }]) => {
    let displayLabel: string;
    if (count > 1 && sumQty !== null) {
      // Quantities could be summed: show "3 unidad Ajo" instead of "1 unidad Ajo (×3)"
      displayLabel = `${formatQty(sumQty)} ${qtyRest}`.trim();
    } else if (count > 1) {
      // Mixed units or no quantity — show occurrence count as fallback
      displayLabel = `${label} (×${count})`;
    } else {
      displayLabel = label;
    }
    return {
      id: `merged-${key.replace(/\s+/g, "-")}`,
      label: displayLabel,
      fromPlan,
    };
  });
}

// ─── Build grocery items from the weekly plan ──────────────────────────────

/**
 * Returns raw (un-merged) ingredient lines from the weekly plan.
 * Callers should merge these together with any manual items using
 * mergeGroceryItems so the merge happens only once.
 */
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
  // Return raw items — do NOT merge here; GroceryListView merges once
  // together with manual items so there is only a single merge pass.
  return items;
}
