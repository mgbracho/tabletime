import type { Recipe } from "@/lib/sync/use-tabletime-data";
import type { HouseholdMember } from "@/lib/hooks/use-household-profile";

export function isExample(id: string) {
  return /^([1-9]|1[0-5])$/.test(id);
}

export function filterRecipes(
  recipes: Recipe[],
  search: string,
  activeTag: string | null,
  options?: { onlyFavorites?: boolean; onlyFamilyApproved?: boolean }
): Recipe[] {
  const q = search.toLowerCase().trim();
  return recipes.filter((r) => {
    const matchTag = !activeTag || r.tags?.some((t) => t.toLowerCase() === activeTag.toLowerCase());
    if (!matchTag) return false;
    if (options?.onlyFavorites && !r.is_favorite) return false;
    if (options?.onlyFamilyApproved && !r.family_approved) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q)) ||
      r.ingredients?.toLowerCase().includes(q)
    );
  });
}

export function scaleIngredientLines(
  ingredientsText: string,
  defaultServings: number,
  targetServings: number
): string {
  if (!ingredientsText.trim() || defaultServings <= 0 || targetServings <= 0) return ingredientsText;
  const factor = targetServings / defaultServings;
  if (Math.abs(factor - 1) < 0.01) return ingredientsText;
  return ingredientsText
    .split(/\n/)
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!match) return line;
      const num = parseFloat(match[1].replace(",", "."));
      const rest = match[2] ?? "";
      const scaled = num * factor;
      const display =
        scaled >= 10 || scaled % 1 === 0 ? Math.round(scaled).toString() : scaled.toFixed(1);
      return display + (rest ? " " + rest : "");
    })
    .join("\n");
}

export function getRecipeConflicts(
  recipe: Recipe,
  members: HouseholdMember[]
): { displayName: string; missingTags: string[] }[] {
  const recipeTags = (recipe.tags ?? []).map((t) => t.toLowerCase());
  return members
    .map((m) => {
      const missing = m.dietary_restrictions.filter(
        (r) => !recipeTags.some((t) => t.includes(r.toLowerCase()) || r.toLowerCase().includes(t))
      );
      if (missing.length === 0) return null;
      return {
        displayName: m.display_name?.trim() || m.email || "Un miembro",
        missingTags: missing,
      };
    })
    .filter((x): x is { displayName: string; missingTags: string[] } => x !== null);
}
