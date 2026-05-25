"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/sync/use-tabletime-data";
import { useLanguage } from "@/lib/i18n";
import { SUGGESTED_TAGS, MEAL_LABELS, type MealType } from "@/lib/constants";
import { filterRecipes } from "@/lib/utils/recipes";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

// Human-readable language names for the translate button label
const LANG_NAMES: Record<string, string> = {
  ES: "Español",
  EN: "English",
  DE: "Deutsch",
};

export function RecipesView({
  recipes,
  onAddRecipe,
  onRemoveRecipe,
  onUpdateRecipe,
}: {
  recipes: Recipe[];
  onAddRecipe: (title: string, ingredients?: string, instructions?: string, tags?: string[], default_servings?: number, image_url?: string, lang?: string, source_url?: string, meal_types?: MealType[]) => void;
  onRemoveRecipe: (id: string) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
}) {
  const { t, lang } = useLanguage();
  const targetLang = lang.toUpperCase();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newIngredients, setNewIngredients] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newServings, setNewServings] = useState(4);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyFamilyApproved, setOnlyFamilyApproved] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [viewServings, setViewServings] = useState(4);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newLang, setNewLang] = useState("");       // language detected during URL import
  const [newSourceUrl, setNewSourceUrl] = useState(""); // original URL from import
  const [newMealTypes, setNewMealTypes] = useState<MealType[]>([]); // meal slots this recipe is for
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Track per-recipe translate state: null | "loading" | "done" | "error"
  const [translateState, setTranslateState] = useState<Record<string, "loading" | "done" | "error">>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const imageUrl = newImageUrl.trim() || undefined;
    if (editingId) {
      onUpdateRecipe(editingId, {
        title,
        ingredients: newIngredients.trim() || undefined,
        instructions: newInstructions.trim() || undefined,
        tags: newTags.length > 0 ? newTags : undefined,
        default_servings: newServings,
        image_url: imageUrl,
        meal_types: newMealTypes.length > 0 ? newMealTypes : null,
      });
      setEditingId(null);
    } else {
      onAddRecipe(
        title,
        newIngredients.trim() || undefined,
        newInstructions.trim() || undefined,
        newTags.length > 0 ? newTags : undefined,
        newServings,
        imageUrl,
        newLang || undefined,
        newSourceUrl || undefined,
        newMealTypes.length > 0 ? newMealTypes : undefined,
      );
    }
    setNewTitle(""); setNewIngredients(""); setNewInstructions(""); setNewTags([]);
    setNewServings(4); setNewImageUrl(""); setNewLang(""); setNewSourceUrl(""); setNewMealTypes([]); setShowForm(false);
  };

  const startEdit = (r: Recipe) => {
    setEditingId(r.id);
    setNewTitle(r.title);
    setNewIngredients(r.ingredients ?? "");
    setNewInstructions(r.instructions ?? "");
    setNewTags(r.tags ?? []);
    setNewServings(r.default_servings ?? 4);
    setNewImageUrl(r.image_url ?? "");
    setNewLang("");
    setNewSourceUrl("");
    setNewMealTypes(r.meal_types ? [...r.meal_types] : []);
    setShowForm(true);
  };

  const handleRecipePatch = (id: string, patch: Partial<Recipe>) => {
    onUpdateRecipe(id, patch);
    if (viewingRecipe?.id === id) setViewingRecipe((prev) => (prev ? { ...prev, ...patch } : null));
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass current UI language so import translates to the right language
        body: JSON.stringify({ url, targetLang }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? t("rec.cannotConnect")); return; }
      setNewTitle(data.title ?? "");
      setNewIngredients(data.ingredients ?? "");
      setNewInstructions(data.instructions ?? "");
      setNewImageUrl(data.image_url ?? "");
      setNewLang(data.lang ?? "");
      setNewSourceUrl(data.source_url ?? "");
      setShowImport(false); setImportUrl(""); setShowForm(true);
    } catch {
      setImportError(t("rec.cannotConnect"));
    } finally {
      setImportLoading(false);
    }
  };

  const handleTranslate = async (r: Recipe) => {
    setTranslateState((prev) => ({ ...prev, [r.id]: "loading" }));
    try {
      const res = await fetch("/api/translate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: r.title,
          ingredients: r.ingredients ?? "",
          instructions: r.instructions,
          targetLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      handleRecipePatch(r.id, {
        title: data.title ?? r.title,
        ingredients: data.ingredients ?? r.ingredients,
        instructions: data.instructions ?? r.instructions,
        lang: data.lang ?? undefined,
      });
      setTranslateState((prev) => ({ ...prev, [r.id]: "done" }));
      // Clear feedback after 2s
      setTimeout(() => setTranslateState((prev) => {
        const next = { ...prev }; delete next[r.id]; return next;
      }), 2000);
    } catch {
      setTranslateState((prev) => ({ ...prev, [r.id]: "error" }));
      setTimeout(() => setTranslateState((prev) => {
        const next = { ...prev }; delete next[r.id]; return next;
      }), 3000);
    }
  };

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();
  const filteredRecipes = filterRecipes(recipes, search, activeTag, {
    onlyFavorites: onlyFavorites || undefined,
    onlyFamilyApproved: onlyFamilyApproved || undefined,
  });

  const langLabel = LANG_NAMES[targetLang] ?? targetLang;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
        <p className="text-sm font-medium text-emerald-800">
          {recipes.length === 1 ? t("rec.library", { n: recipes.length }) : t("rec.library_plural", { n: recipes.length })}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowImport(true)} className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50">
            {t("rec.importUrl")}
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800">
            {t("rec.addRecipe")}
          </button>
        </div>
      </div>

      {showImport && (
        <form onSubmit={handleImportSubmit} className="rounded-xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-emerald-300/10 p-4">
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.pasteUrl")}</label>
          <p className="mb-3 text-xs text-stone-600">{t("rec.urlDesc")}</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
              placeholder={t("rec.urlPlaceholder")}
              className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={importLoading}
            />
            <button type="submit" disabled={importLoading || !importUrl.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50">
              {importLoading ? t("rec.importing") : t("rec.import")}
            </button>
          </div>
          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
          <button type="button" onClick={() => { setShowImport(false); setImportUrl(""); setImportError(null); }} className="mt-2 text-sm text-stone-500 hover:text-stone-700">{t("rec.cancel")}</button>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border-l-4 border-l-emerald-700 border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-stone-900">{editingId ? t("rec.editRecipe") : t("rec.newRecipe")}</h3>
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.recipeName")}</label>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("rec.namePlaceholder")} className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" autoFocus />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.ingredients")}</label>
          <textarea value={newIngredients} onChange={(e) => setNewIngredients(e.target.value)} placeholder={t("rec.ingredientsPlaceholder")} rows={3} className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.steps")}</label>
          <textarea value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)} placeholder={t("rec.stepsPlaceholder")} rows={3} className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.tags")}</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => setNewTags((prev) => prev.includes(tag) ? prev.filter((tg) => tg !== tag) : [...prev, tag])} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${newTags.includes(tag) ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}>
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newTags.filter((tg) => !(SUGGESTED_TAGS as readonly string[]).includes(tg)).join(", ")}
            onChange={(e) => {
              const val = e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
              const suggested = newTags.filter((tg) => (SUGGESTED_TAGS as readonly string[]).includes(tg));
              setNewTags([...suggested, ...val]);
            }}
            placeholder={t("rec.otherTags")}
            className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.defaultServings")}</label>
          <input type="number" min={1} max={24} value={newServings} onChange={(e) => setNewServings(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 4)))} className="mb-3 w-20 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.photo")}</label>
          {newImageUrl && (
            <div className="mb-2 flex items-center gap-3">
              <img src={newImageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" onError={() => setNewImageUrl("")} />
              <button type="button" onClick={() => setNewImageUrl("")} className="text-xs text-stone-400 hover:text-stone-600">{t("rec.removePhoto")}</button>
            </div>
          )}
          <input type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <label className="mb-2 block text-xs font-medium text-emerald-800">{t("rec.mealTypes")}</label>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {MEAL_LABELS.map((meal) => (
              <button
                key={meal}
                type="button"
                onClick={() => setNewMealTypes((prev) =>
                  prev.includes(meal) ? prev.filter((m) => m !== meal) : [...prev, meal]
                )}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  newMealTypes.includes(meal)
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
              >
                {t(`meal.${meal}`)}
              </button>
            ))}
            {newMealTypes.length === 0 && (
              <span className="text-xs text-stone-400">{t("rec.allMeals")}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">{t("rec.save")}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setNewTitle(""); setNewIngredients(""); setNewInstructions(""); setNewTags([]); setNewServings(4); setNewImageUrl(""); setNewLang(""); setNewSourceUrl(""); setNewMealTypes([]); }} className="rounded-lg border border-emerald-200 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50">{t("rec.cancel")}</button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("rec.search")} className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setActiveTag(null)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${!activeTag ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}>{t("cal.allTags")}</button>
            {allTags.map((tag) => (
              <button key={tag} type="button" onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${activeTag === tag ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"}`}>{tag}</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">{t("rec.filters")}</span>
          <button type="button" onClick={() => setOnlyFavorites((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${onlyFavorites ? "bg-amber-200 text-amber-900" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>{t("rec.favorites")}</button>
          <button type="button" onClick={() => setOnlyFamilyApproved((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${onlyFamilyApproved ? "bg-emerald-200 text-stone-900" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>Family approved</button>
        </div>
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          {recipes.length === 0 ? t("rec.noRecipes") : t("rec.noMatch")}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredRecipes.map((r, idx) => {
            const tState = translateState[r.id];
            // Hide translate button if recipe is already in the current UI language
            const alreadyInLang = r.lang != null &&
              r.lang.toUpperCase().split("-")[0] === targetLang.split("-")[0];
            return (
              <li key={r.id} className={`flex items-center justify-between gap-3 rounded-lg border border-emerald-100 px-4 py-3 shadow-sm ${idx % 3 === 0 ? "border-l-4 border-l-emerald-700 bg-emerald-50/60" : idx % 3 === 1 ? "border-l-4 border-l-emerald-500 bg-emerald-300/10" : "border-l-4 border-l-amber-600 bg-amber-50/60"}`}>
                {r.image_url && (
                  <img src={r.image_url} alt={r.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleRecipePatch(r.id, { is_favorite: !r.is_favorite })} className="shrink-0 rounded p-0.5 text-lg leading-none transition hover:scale-110" aria-label={r.is_favorite ? t("rec.removeFavorite") : t("rec.addFavorite")}>
                      <span className={r.is_favorite ? "text-amber-500" : "text-stone-300"}>♥</span>
                    </button>
                    <button type="button" onClick={() => { setViewingRecipe(r); setViewServings(r.default_servings ?? 4); }} className="text-left">
                      <span className="font-medium text-stone-900 hover:underline">{r.title}</span>
                    </button>
                    {r.family_approved && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">Family approved</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={(e) => { e.stopPropagation(); handleRecipePatch(r.id, { rating: r.rating === n ? null : n }); }} className="rounded p-0 text-amber-400/80 hover:text-amber-500" aria-label={n === 1 ? t("modal.starN", { n }) : t("modal.starsN", { n })}>
                        <span className={r.rating != null && n <= r.rating ? "text-amber-400" : "text-stone-300"}>★</span>
                      </button>
                    ))}
                  </div>
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.tags.map((tg) => <span key={tg} className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">{tg}</span>)}
                    </div>
                  )}
                  {r.meal_types && r.meal_types.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.meal_types.map((m) => (
                        <span key={m} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t(`meal.${m}`)}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.ingredients && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{r.ingredients}</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {/* Source URL link */}
                  {r.source_url && (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("rec.sourceUrl")}
                      aria-label={t("rec.sourceUrl")}
                      className="rounded-full p-1.5 text-stone-400 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      🔗
                    </a>
                  )}
                  {/* Translate button — hidden when recipe is already in the current UI language */}
                  {!alreadyInLang && (
                    <button
                      type="button"
                      onClick={() => handleTranslate(r)}
                      disabled={tState === "loading"}
                      title={t("rec.translate", { lang: langLabel })}
                      aria-label={t("rec.translate", { lang: langLabel })}
                      className={`rounded-full p-1.5 text-xs transition ${
                        tState === "done"
                          ? "text-emerald-700 bg-emerald-50"
                          : tState === "error"
                            ? "text-red-500 bg-red-50"
                            : "text-stone-400 hover:bg-emerald-50 hover:text-emerald-700"
                      }`}
                    >
                      {tState === "loading" ? "⏳" : tState === "done" ? "✓" : tState === "error" ? "✕" : "🌐"}
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(r)} className="rounded-full p-1.5 text-stone-400 hover:bg-emerald-50 hover:text-emerald-700" aria-label={t("rec.editAria")}>✎</button>
                  <button type="button" onClick={() => onRemoveRecipe(r.id)} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600" aria-label={t("rec.deleteAria")}>✕</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {viewingRecipe && (
        <RecipeDetailModal
          recipe={viewingRecipe}
          viewServings={viewServings}
          setViewServings={setViewServings}
          onClose={() => setViewingRecipe(null)}
          onEdit={(r) => startEdit(r)}
          onUpdateRecipe={handleRecipePatch}
          onTranslate={
            viewingRecipe?.lang != null &&
            viewingRecipe.lang.toUpperCase().split("-")[0] === targetLang.split("-")[0]
              ? undefined
              : handleTranslate
          }
          translateState={translateState}
          langLabel={langLabel}
        />
      )}
    </div>
  );
}
