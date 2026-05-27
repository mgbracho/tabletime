import type { Recipe, PlanState, ThemeDays } from "@/lib/sync/use-tabletime-data";
import { MEAL_LABELS, MealType, DAY_NAMES, isSlotStatus, SLOT_STATUS_LABELS, type SlotStatusValue } from "@/lib/constants";

export function slotKey(date: Date, meal: string): string {
  return `${date.toISOString().slice(0, 10)}-${meal}`;
}

export function getWeekDates(from: Date): { date: Date; dayLabel: string; dateLabel: string }[] {
  const d = new Date(from);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return { date: x, dayLabel: DAY_NAMES[i], dateLabel: x.getDate().toString() };
  });
}

export function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMonthGrid(
  monthStart: Date
): { date: Date; dayLabel: string; dateLabel: string; isCurrentMonth: boolean }[] {
  const first = new Date(monthStart);
  const dayOfWeek = first.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  first.setDate(first.getDate() + diff);
  const month = monthStart.getMonth();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return {
      date: d,
      dayLabel: DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1],
      dateLabel: d.getDate().toString(),
      isCurrentMonth: d.getMonth() === month,
    };
  });
}

export interface PrintPlanOptions {
  locale?: string;
  title?: string;
  formatWeekOf?: (week: string) => string;
  getStatusLabel?: (s: string) => string;
  getMealLabel?: (m: string) => string;
  getDayLabel?: (index: number) => string;
}

export function printPlanToPdf(
  plan: Record<string, string>,
  recipes: { id: string; title: string }[],
  themeDays: Record<number, Partial<Record<string, string>>>,
  visibleMeals: readonly string[] = MEAL_LABELS,
  options: PrintPlanOptions = {}
) {
  const {
    locale = "es",
    title = "Plan semanal - TableTime",
    formatWeekOf = (week) => `Semana del ${week}`,
    getStatusLabel = (s) => SLOT_STATUS_LABELS[s as SlotStatusValue] ?? s,
    getMealLabel = (m) => m,
    getDayLabel,
  } = options;

  const weekStart = getWeekStart();
  const weekDays = getWeekDates(weekStart);
  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString(locale, { month: "long" });
  const getRecipeTitle = (id: string) => recipes.find((r) => r.id === id)?.title ?? id;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const thCells = weekDays
    .map(
      (d, i) => {
        const dayLabel = getDayLabel ? getDayLabel(i) : d.dayLabel;
        return `<th style="padding:8px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;">${escape(dayLabel)}<br><span style="color:#6b7280">${d.dateLabel}</span></th>`;
      }
    )
    .join("");

  const rows = visibleMeals
    .map((meal) => {
      const cells = weekDays.map((d, dayIndex) => {
        const key = `${d.date.toISOString().slice(0, 10)}-${meal}`;
        const value = plan[key];
        const theme = themeDays[dayIndex]?.[meal];
        let content = "—";
        if (value) {
          content = isSlotStatus(value) ? getStatusLabel(value) : getRecipeTitle(value);
        }
        return `<td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;vertical-align:top;">${escape(content)}${theme ? `<br><span style="color:#b45309;font-size:10px">${escape(theme)}</span>` : ""}</td>`;
      });
      const mealLabel = getMealLabel(meal);
      return `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-size:11px;font-weight:600;background:#f0fdfa;">${escape(mealLabel)}</td>${cells.join("")}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;font-size:14px}h1{font-size:1.1rem;margin:0 0 4px}p{margin:0 0 16px;color:#555}table{border-collapse:collapse;width:100%;max-width:800px}</style>
</head><body><h1>${escape(title)}</h1><p>${escape(formatWeekOf(weekTitle))}</p><table><thead><tr><th style="padding:8px;border:1px solid #e5e7eb"></th>${thCells}</tr></thead><tbody>${rows}</tbody></table></body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 100);
}

function getIngredientTokens(ingredients: string | undefined): Set<string> {
  if (!ingredients?.trim()) return new Set();
  const text = ingredients
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|oz|lb|ud|u\.?)\b/g, "")
    .replace(/\d+/g, " ");
  return new Set(
    text.split(/[\s\n,;]+/).filter((w) => w.length > 2 && !/^\d+$/.test(w))
  );
}

const PROTEIN_KEYWORDS: Record<string, string[]> = {
  pollo: ["pollo", "chicken", "ave"],
  beef: ["ternera", "vaca", "beef", "carne"],
  pescado: ["pescado", "fish", "atún", "salmón", "merluza", "gamba", "mejillón", "calamar"],
  cerdo: ["cerdo", "pork", "bacon", "jamón", "chorizo"],
  legumbres: ["lentejas", "garbanzos", "alubias", "legumbres", "quinoa"],
  huevo: ["huevo", "egg", "huevos"],
};

function getProteinsForRecipe(recipe: Recipe): Set<string> {
  const text = `${recipe.title ?? ""} ${recipe.ingredients ?? ""}`.toLowerCase();
  const proteins = new Set<string>();
  for (const [protein, keywords] of Object.entries(PROTEIN_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) proteins.add(protein);
  }
  return proteins;
}

export function generateSuggestedPlanForWeek(
  recipes: Recipe[],
  themeDays: ThemeDays,
  currentPlan: PlanState,
  weekStart: Date,
  visibleMeals: readonly MealType[] = MEAL_LABELS
): PlanState {
  if (recipes.length === 0) return {};
  const weekDays = getWeekDates(weekStart);
  const tokensByRecipe = new Map(recipes.map((r) => [r.id, getIngredientTokens(r.ingredients)]));
  const proteinsByRecipe = new Map(recipes.map((r) => [r.id, getProteinsForRecipe(r)]));

  // --- Cross-week recency: scan plan history for recipes used in the last 28 days ---
  const weekStartMs = weekStart.getTime();
  const cutoffMs = weekStartMs - 28 * 24 * 60 * 60 * 1000;
  const recentDaysAgo: Record<string, number> = {}; // recipeId → days since last use
  for (const [key, value] of Object.entries(currentPlan)) {
    if (!value || isSlotStatus(value)) continue;
    const slotMs = new Date(key.slice(0, 10)).getTime();
    if (slotMs >= cutoffMs && slotMs < weekStartMs) {
      const daysAgo = Math.floor((weekStartMs - slotMs) / (24 * 60 * 60 * 1000));
      if (recentDaysAgo[value] === undefined || recentDaysAgo[value] > daysAgo) {
        recentDaysAgo[value] = daysAgo;
      }
    }
  }

  const slots: { dayIndex: number; meal: MealType; key: string }[] = [];
  for (let i = 0; i < weekDays.length; i++) {
    for (const meal of visibleMeals) {
      slots.push({ dayIndex: i, meal, key: slotKey(weekDays[i].date, meal) });
    }
  }

  const plan: PlanState = {};
  const chosenThisWeek: Recipe[] = [];
  const usedThisWeek = new Set<string>(); // hard dedup: same recipe cannot appear twice in a week
  const usedProteinsThisWeek: Record<string, number> = {};

  const scoreRecipe = (r: Recipe): number => {
    // Recency score: prefer recipes not used recently.
    // Use plan history (accurate) with last_used_at as fallback.
    let daysSince: number;
    if (recentDaysAgo[r.id] !== undefined) {
      daysSince = recentDaysAgo[r.id];
    } else if (r.last_used_at) {
      const d = new Date(r.last_used_at);
      d.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      daysSince = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    } else {
      daysSince = 60; // never used → top priority
    }
    // 0 if used ≤7 days ago, ramps to 1 at 21+ days
    const recencyScore = daysSince <= 7 ? 0 : daysSince >= 21 ? 1 : (daysSince - 7) / 14;

    // Ingredient variety vs recipes already assigned this week
    let varietyScore = 1;
    if (chosenThisWeek.length > 0) {
      const myTokens = tokensByRecipe.get(r.id) ?? new Set();
      let totalOverlap = 0;
      for (const other of chosenThisWeek) {
        const otherTokens = tokensByRecipe.get(other.id) ?? new Set();
        const inter = [...myTokens].filter((t) => otherTokens.has(t)).length;
        const un = new Set([...myTokens, ...otherTokens]).size;
        if (un > 0) totalOverlap += inter / un;
      }
      varietyScore = 1 - totalOverlap / chosenThisWeek.length;
    }

    // Protein balance: penalise if same protein group used 2+ times already
    const myProteins = proteinsByRecipe.get(r.id) ?? new Set();
    for (const p of myProteins) {
      if ((usedProteinsThisWeek[p] ?? 0) >= 2) varietyScore -= 0.25;
    }
    varietyScore = Math.max(0, varietyScore);

    // Preference bonuses (minor)
    const ratingBonus = r.rating != null ? (r.rating / 5) * 0.08 : 0;
    const favoriteBonus = r.is_favorite ? 0.05 : 0;

    // Small random factor so each "Create plan" run feels different
    return recencyScore * 0.45 + varietyScore * 0.35 + ratingBonus + favoriteBonus + Math.random() * 0.15;
  };

  for (const { dayIndex, meal, key } of slots) {
    // Keep slots already set in the current plan
    if (currentPlan[key]) {
      plan[key] = currentPlan[key];
      const r = recipes.find((x) => x.id === currentPlan[key]);
      if (r) {
        chosenThisWeek.push(r);
        usedThisWeek.add(r.id);
        for (const p of getProteinsForRecipe(r)) {
          usedProteinsThisWeek[p] = (usedProteinsThisWeek[p] ?? 0) + 1;
        }
      }
      continue;
    }

    // Build candidate pool filtered by theme
    const theme = themeDays[dayIndex]?.[meal]?.trim().toLowerCase();
    const themeWords = theme ? theme.split(/\s+/).filter(Boolean) : [];
    let candidates =
      themeWords.length > 0
        ? recipes.filter((r) => {
            const tagStr = (r.tags ?? []).join(" ").toLowerCase();
            return themeWords.some((w) => tagStr.includes(w) || r.title.toLowerCase().includes(w));
          })
        : [...recipes];
    if (themeWords.length > 0 && candidates.length === 0) continue;
    if (candidates.length === 0) candidates = [...recipes];

    // Filter by meal type
    const mealCompatible = candidates.filter(
      (r) => !r.meal_types || r.meal_types.length === 0 || r.meal_types.includes(meal)
    );
    if (mealCompatible.length === 0) continue;

    // Prefer recipes not yet used this week; only allow repeats if no fresh options exist
    const fresh = mealCompatible.filter((r) => !usedThisWeek.has(r.id));
    const pool = fresh.length > 0 ? fresh : mealCompatible;

    // Score each candidate once (avoids non-deterministic sort with Math.random inside)
    const scored = pool.map((r) => ({ r, s: scoreRecipe(r) }));
    scored.sort((a, b) => b.s - a.s);
    const picked = scored[0].r;

    plan[key] = picked.id;
    chosenThisWeek.push(picked);
    usedThisWeek.add(picked.id);
    for (const p of getProteinsForRecipe(picked)) {
      usedProteinsThisWeek[p] = (usedProteinsThisWeek[p] ?? 0) + 1;
    }
  }

  return plan;
}
