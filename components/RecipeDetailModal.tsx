"use client";

import type { Recipe } from "@/lib/sync/use-tabletime-data";
import { useLanguage } from "@/lib/i18n";
import { scaleIngredientLines } from "@/lib/utils/recipes";

export function RecipeDetailModal({
  recipe,
  viewServings,
  setViewServings,
  onClose,
  onEdit,
  onUpdateRecipe,
  onTranslate,
  translateState,
  langLabel,
}: {
  recipe: Recipe;
  viewServings: number;
  setViewServings: (n: number) => void;
  onClose: () => void;
  onEdit?: (recipe: Recipe) => void;
  onUpdateRecipe?: (id: string, patch: Partial<Recipe>) => void;
  onTranslate?: (recipe: Recipe) => void;
  translateState?: Record<string, "loading" | "done" | "error">;
  langLabel?: string;
}) {
  const { t } = useLanguage();
  const tState = translateState?.[recipe.id];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t("modal.viewRecipe")}
      >
        {recipe.image_url && (
          <div className="h-44 w-full overflow-hidden">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
            />
          </div>
        )}
        <div className="border-b border-teal-100 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-teal-900">{recipe.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              aria-label={t("modal.close")}
            >
              ✕
            </button>
          </div>
          {onUpdateRecipe && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onUpdateRecipe(recipe.id, { is_favorite: !recipe.is_favorite })}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-amber-50"
                aria-label={recipe.is_favorite ? t("modal.removeFavorite") : t("modal.addFavorite")}
              >
                <span className={recipe.is_favorite ? "text-amber-500" : "text-zinc-300"}>♥</span>
                <span className="text-xs text-zinc-600">{t("modal.favorite")}</span>
              </button>
              <div className="flex items-center gap-0.5">
                <span className="mr-1 text-xs text-zinc-500">{t("modal.rating")}</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onUpdateRecipe(recipe.id, { rating: recipe.rating === n ? null : n })}
                    className="rounded p-0.5 text-lg leading-none transition hover:scale-110"
                    aria-label={n === 1 ? t("modal.starN", { n }) : t("modal.starsN", { n })}
                  >
                    <span className={recipe.rating != null && n <= recipe.rating ? "text-amber-400" : "text-zinc-300"}>★</span>
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-teal-50">
                <input
                  type="checkbox"
                  checked={recipe.family_approved === true}
                  onChange={(e) => onUpdateRecipe(recipe.id, { family_approved: e.target.checked })}
                  className="h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-400"
                />
                <span className="text-xs font-medium text-teal-800">Family approved</span>
              </label>
            </div>
          )}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.map((tg) => (
                <span key={tg} className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                  {tg}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">{t("modal.servings")}</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setViewServings(n)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  viewServings === n ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700 hover:bg-teal-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {recipe.ingredients && (
            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-teal-800">
                {viewServings !== (recipe.default_servings ?? 4)
                  ? t("modal.ingredientsFor", { n: viewServings })
                  : t("modal.ingredients")}
              </h3>
              <ul className="space-y-1 text-sm text-zinc-700">
                {scaleIngredientLines(recipe.ingredients, recipe.default_servings ?? 4, viewServings)
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i} className="flex flex-wrap">
                      <span className="mr-2 text-teal-500">•</span>
                      {line}
                    </li>
                  ))}
              </ul>
            </section>
          )}
          {recipe.instructions && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-teal-800">{t("modal.steps")}</h3>
              <ol className="list-inside list-decimal space-y-2 text-sm text-zinc-700">
                {recipe.instructions
                  .split(/\n+/)
                  .map((step) => step.trim())
                  .filter(Boolean)
                  .map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
              </ol>
            </section>
          )}
          {!recipe.ingredients && !recipe.instructions && (
            <p className="text-sm text-zinc-500">{t("modal.noContent")}</p>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-teal-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Source URL + translate button */}
          <div className="flex flex-wrap items-center gap-2">
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
              >
                <span>🔗</span>
                <span>{t("modal.viewSource")}</span>
              </a>
            )}
            {onTranslate && (
              <button
                type="button"
                onClick={() => onTranslate(recipe)}
                disabled={tState === "loading"}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  tState === "done"
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : tState === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-teal-200 text-teal-700 hover:bg-teal-50"
                }`}
                title={t("rec.translate", { lang: langLabel ?? "" })}
              >
                <span>{tState === "loading" ? "⏳" : tState === "done" ? "✓" : tState === "error" ? "✕" : "🌐"}</span>
                <span>
                  {tState === "loading"
                    ? t("rec.translating")
                    : tState === "done"
                      ? t("rec.translateDone")
                      : tState === "error"
                        ? t("rec.translateError")
                        : t("rec.translate", { lang: langLabel ?? "" })}
                </span>
              </button>
            )}
          </div>
          <div className="flex gap-2 sm:shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => { onClose(); onEdit(recipe); }}
                className="flex-1 rounded-lg border border-teal-200 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 sm:flex-none"
              >
                {t("modal.edit")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 sm:flex-none"
            >
              {t("modal.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
