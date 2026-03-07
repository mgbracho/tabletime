"use client";

import { useTableTimeData } from "@/lib/sync/use-tabletime-data";
import { useState } from "react";

const TABS = [
  { id: "calendar", label: "Calendario" },
  { id: "recipes", label: "Recetas" },
  { id: "grocery", label: "Lista de la compra" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MEAL_LABELS = ["Desayuno", "Comida", "Cena"] as const;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Recipe = { id: string; title: string; ingredients?: string; instructions?: string; tags?: string[]; default_servings?: number };

const SUGGESTED_TAGS = ["kid-friendly", "rápida", "vegetariana", "alta proteína", "económica", "sin gluten"] as const;

function isExample(id: string) {
  return /^[1-8]$/.test(id);
}

function filterRecipes(
  recipes: Recipe[],
  search: string,
  activeTag: string | null
): Recipe[] {
  const q = search.toLowerCase().trim();
  return recipes.filter((r) => {
    const matchTag = !activeTag || r.tags?.some((t) => t.toLowerCase() === activeTag.toLowerCase());
    if (!matchTag) return false;
    if (!q) return true;
    const inTitle = r.title.toLowerCase().includes(q);
    const inTags = r.tags?.some((t) => t.toLowerCase().includes(q));
    const inIngredients = r.ingredients?.toLowerCase().includes(q);
    return inTitle || inTags || inIngredients;
  });
}

/** Escala cantidades en líneas de ingredientes (ej. "400g pasta" → "800g pasta" para factor 2). */
function scaleIngredientLines(ingredientsText: string, defaultServings: number, targetServings: number): string {
  if (!ingredientsText.trim() || defaultServings <= 0 || targetServings <= 0) return ingredientsText;
  const factor = targetServings / defaultServings;
  if (Math.abs(factor - 1) < 0.01) return ingredientsText;
  return ingredientsText
    .split(/\n/)
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!match) return line;
      const numStr = match[1].replace(",", ".");
      const num = parseFloat(numStr);
      const rest = match[2] ?? "";
      const scaled = num * factor;
      const display = scaled >= 10 || scaled % 1 === 0 ? Math.round(scaled).toString() : scaled.toFixed(1);
      return display + (rest ? " " + rest : "");
    })
    .join("\n");
}

function slotKey(date: Date, meal: string): string {
  return `${date.toISOString().slice(0, 10)}-${meal}`;
}

function getWeekDates(from: Date): { date: Date; dayLabel: string; dateLabel: string }[] {
  const d = new Date(from);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return {
      date: x,
      dayLabel: DAY_NAMES[i],
      dateLabel: x.getDate().toString(),
    };
  });
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

type PlanState = Record<string, string>;

type MealType = "Desayuno" | "Comida" | "Cena";
type ThemeDays = Record<number, Partial<Record<MealType, string>>>;

function ThemeConfig({
  themeDays,
  setThemeDays,
}: {
  themeDays: ThemeDays;
  setThemeDays: React.Dispatch<React.SetStateAction<ThemeDays>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-900"
      >
        <span>Temas de la semana</span>
        <span className="text-amber-600">{open ? "▼" : "▶"}</span>
      </button>
      {open && (
        <div className="border-t border-amber-100 px-4 py-3">
          <p className="mb-3 text-xs text-amber-800">
            Asigna temas por día y comida. Puedes tener uno para el desayuno y otro para la cena, por ejemplo. Las recetas que coincidan aparecerán primero al elegir.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="pb-2 pr-2 font-medium text-amber-800">Día</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Desayuno</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Comida</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Cena</th>
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((day, i) => (
                  <tr key={i} className="border-b border-amber-100">
                    <td className="py-2 pr-2 font-medium text-amber-900">{day}</td>
                    {(["Desayuno", "Comida", "Cena"] as const).map((meal) => (
                      <td key={meal} className="px-2 py-2">
                        <input
                          type="text"
                          value={themeDays[i]?.[meal] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setThemeDays((prev) => {
                              const next = { ...prev };
                              const dayThemes = { ...next[i] };
                              if (val) dayThemes[meal] = val;
                              else delete dayThemes[meal];
                              if (Object.keys(dayThemes).length > 0) next[i] = dayThemes;
                              else delete next[i];
                              return next;
                            });
                          }}
                          placeholder="Ej. Pasta"
                          className="w-full rounded border border-amber-200 px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarWeekView({
  recipes,
  plan,
  setPlan,
  themeDays,
}: {
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
  themeDays: ThemeDays;
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  });

  const [openSlot, setOpenSlot] = useState<{ date: Date; meal: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTag, setPickerTag] = useState<string | null>(null);

  const weekDays = getWeekDates(weekStart);
  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString("es", { month: "long" });

  const assignRecipe = (recipeId: string) => {
    if (!openSlot) return;
    setPlan((prev) => ({
      ...prev,
      [slotKey(openSlot.date, openSlot.meal)]: recipeId,
    }));
    setOpenSlot(null);
  };

  const clearSlot = (date: Date, meal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlan((prev) => {
      const next = { ...prev };
      delete next[slotKey(date, meal)];
      return next;
    });
  };

  const getRecipeTitle = (recipeId: string) =>
    recipes.find((r) => r.id === recipeId)?.title ?? recipeId;

  const goToPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goToNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const copyFromPreviousWeek = () => {
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevDays = getWeekDates(prevStart);
    setPlan((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 7; i++) {
        for (const meal of MEAL_LABELS) {
          const prevKey = slotKey(prevDays[i].date, meal);
          const currKey = slotKey(weekDays[i].date, meal);
          const recipeId = prev[prevKey];
          if (recipeId) next[currKey] = recipeId;
        }
      }
      return next;
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevWeek}
            className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            ← Anterior
          </button>
          <span className="text-sm font-medium text-emerald-800">
            Semana del {weekTitle}
          </span>
          <button
            type="button"
            onClick={goToNextWeek}
            className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Siguiente →
          </button>
        </div>
        <button
          type="button"
          onClick={copyFromPreviousWeek}
          className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
        >
          Copiar semana anterior
        </button>
      </div>
      <div className="min-w-[600px] rounded-xl border border-emerald-100 bg-white">
        <div className="grid grid-cols-8 border-b border-emerald-100">
          <div className="p-2 text-xs font-semibold text-zinc-500" />
          {weekDays.map((d, i) => (
            <div
              key={d.date.toISOString()}
              className="border-l border-emerald-50 p-2 text-center"
            >
              <span className="block text-xs font-medium text-emerald-800">
                {d.dayLabel}
              </span>
              <span className="text-xs text-zinc-500">{d.dateLabel}</span>
            </div>
          ))}
        </div>
        {MEAL_LABELS.map((meal) => (
          <div
            key={meal}
            className="grid grid-cols-8 border-b border-emerald-50 last:border-b-0"
          >
            <div className="flex items-center border-r border-emerald-50 bg-emerald-50/50 px-3 py-2 text-xs font-medium text-emerald-800">
              {meal}
            </div>
            {weekDays.map((d, dayIndex) => {
              const key = slotKey(d.date, meal);
              const recipeId = plan[key];
              return (
                <div
                  key={key}
                  className="flex min-h-[52px] items-center justify-center border-l border-emerald-50 p-2"
                >
                  {recipeId ? (
                    <div className="group relative flex w-full items-center justify-center">
                      <span className="truncate px-2 text-xs font-medium text-emerald-900">
                        {getRecipeTitle(recipeId)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => clearSlot(d.date, meal, e)}
                        className="absolute -right-1 -top-1 rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-600 opacity-0 transition hover:bg-zinc-300 group-hover:opacity-100"
                        aria-label="Quitar receta"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOpenSlot({ date: d.date, meal })}
                        className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 px-2 py-1.5 text-xs text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        Añadir
                      </button>
                      {themeDays[dayIndex]?.[meal] && (
                        <span className="text-[10px] font-medium text-amber-600">
                          {themeDays[dayIndex][meal]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {openSlot && (() => {
        const weekdayIndex = (openSlot.date.getDay() + 6) % 7;
        const slotTheme = themeDays[weekdayIndex]?.[openSlot.meal as MealType] ?? "";
        const themeWords = slotTheme
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 1);
        const filtered = filterRecipes(recipes, pickerSearch, pickerTag);
        const matchesTheme = (r: Recipe) =>
          themeWords.length > 0 &&
          themeWords.some(
            (w) =>
              r.title.toLowerCase().includes(w) ||
              (r.tags ?? []).some((t) => t.toLowerCase().includes(w))
          );
        const suggestedRecipes = slotTheme ? filtered.filter(matchesTheme) : [];
        const otherRecipes = slotTheme ? filtered.filter((r) => !matchesTheme(r)) : filtered;
        const pickerTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setOpenSlot(null);
            setPickerSearch("");
            setPickerTag(null);
          }}
          role="presentation"
        >
          <div
            className="mx-4 max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Elegir receta"
          >
            <div className="border-b border-emerald-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-emerald-900">
                Elegir receta para {openSlot.meal}
              </h3>
              <p className="text-xs text-zinc-500">
                {openSlot.date.toLocaleDateString("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              {slotTheme && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  Tema del día: {slotTheme}
                </p>
              )}
            </div>
            <div className="border-b border-emerald-100 px-4 py-2">
              <input
                type="search"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              {pickerTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setPickerTag(null)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      !pickerTag ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Todas
                  </button>
                  {pickerTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPickerTag(pickerTag === t ? null : t)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        pickerTag === t ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ul className="max-h-[40vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-zinc-500">
                  Ninguna receta coincide con el filtro.
                </li>
              ) : (
                <>
                  {slotTheme && suggestedRecipes.length > 0 && (
                    <>
                      <li className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Sugeridas para «{slotTheme}»
                      </li>
                      {suggestedRecipes.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => assignRecipe(r.id)}
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-emerald-50"
                          >
                            <span>{r.title}</span>
                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              ✓ tema
                            </span>
                          </button>
                        </li>
                      ))}
                    </>
                  )}
                  {otherRecipes.length > 0 && (
                    <>
                      {slotTheme && (
                        <li className="sticky top-0 z-10 border-b border-emerald-100 bg-emerald-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          Otras recetas
                        </li>
                      )}
                      {otherRecipes.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => assignRecipe(r.id)}
                            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-zinc-600 transition hover:bg-emerald-50"
                          >
                            <span>{r.title}</span>
                          </button>
                        </li>
                      ))}
                    </>
                  )}
                </>
              )}
            </ul>
            <div className="border-t border-emerald-100 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  setOpenSlot(null);
                  setPickerSearch("");
                  setPickerTag(null);
                }}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function RecipesView({
  recipes,
  onAddRecipe,
  onRemoveRecipe,
  onUpdateRecipe,
}: {
  recipes: Recipe[];
  onAddRecipe: (title: string, ingredients?: string, instructions?: string, tags?: string[], default_servings?: number) => void;
  onRemoveRecipe: (id: string) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newIngredients, setNewIngredients] = useState("");
  const [newInstructions, setNewInstructions] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newServings, setNewServings] = useState(4);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [viewServings, setViewServings] = useState(4);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    if (editingId) {
      onUpdateRecipe(editingId, {
        title,
        ingredients: newIngredients.trim() || undefined,
        instructions: newInstructions.trim() || undefined,
        tags: newTags.length > 0 ? newTags : undefined,
        default_servings: newServings,
      });
      setEditingId(null);
    } else {
      onAddRecipe(
        title,
        newIngredients.trim() || undefined,
        newInstructions.trim() || undefined,
        newTags.length > 0 ? newTags : undefined,
        newServings
      );
    }
    setNewTitle("");
    setNewIngredients("");
    setNewInstructions("");
    setNewTags([]);
    setNewServings(4);
    setShowForm(false);
  };

  const startEdit = (r: Recipe) => {
    setEditingId(r.id);
    setNewTitle(r.title);
    setNewIngredients(r.ingredients ?? "");
    setNewInstructions(r.instructions ?? "");
    setNewTags(r.tags ?? []);
    setNewServings(r.default_servings ?? 4);
    setShowForm(true);
  };

  const allTags = Array.from(
    new Set(recipes.flatMap((r) => r.tags ?? []))
  ).sort();
  const filteredRecipes = filterRecipes(recipes, search, activeTag);

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
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Error al importar");
        return;
      }
      setNewTitle(data.title ?? "");
      setNewIngredients(data.ingredients ?? "");
      setNewInstructions(data.instructions ?? "");
      setShowImport(false);
      setImportUrl("");
      setShowForm(true);
    } catch {
      setImportError("No se pudo conectar. Verifica la URL.");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-700">
          {recipes.length} receta{recipes.length !== 1 ? "s" : ""} en tu biblioteca
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            Importar desde URL
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            + Añadir receta
          </button>
        </div>
      </div>

      {showImport && (
        <form
          onSubmit={handleImportSubmit}
          className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4"
        >
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Pegar URL de la receta
          </label>
          <p className="mb-3 text-xs text-zinc-600">
            Funciona con la mayoría de blogs y webs que usen datos estructurados (schema.org).
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportError(null);
              }}
              placeholder="https://ejemplo.com/receta-pasta..."
              className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              disabled={importLoading}
            />
            <button
              type="submit"
              disabled={importLoading || !importUrl.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {importLoading ? "Importando…" : "Importar"}
            </button>
          </div>
          {importError && (
            <p className="mt-2 text-sm text-red-600">{importError}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setShowImport(false);
              setImportUrl("");
              setImportError(null);
            }}
            className="mt-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            Cancelar
          </button>
        </form>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-emerald-900">
            {editingId ? "Editar receta" : "Nueva receta"}
          </h3>
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Nombre de la receta
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ej: Lentejas con chorizo"
            className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            autoFocus
          />
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Ingredientes (opcional)
          </label>
          <textarea
            value={newIngredients}
            onChange={(e) => setNewIngredients(e.target.value)}
            placeholder="Uno por línea: 200g lentejas, 1 chorizo..."
            rows={3}
            className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Pasos (opcional)
          </label>
          <textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder="1. Sofreír la cebolla..."
            rows={3}
            className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Etiquetas (opcional)
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setNewTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                  )
                }
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  newTags.includes(tag)
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newTags.filter((t) => !(SUGGESTED_TAGS as readonly string[]).includes(t)).join(", ")}
            onChange={(e) => {
              const val = e.target.value
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              const suggested = newTags.filter((t) =>
                (SUGGESTED_TAGS as readonly string[]).includes(t)
              );
              setNewTags([...suggested, ...val]);
            }}
            placeholder="Otras etiquetas (separadas por coma)"
            className="mb-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <label className="mb-2 block text-xs font-medium text-emerald-800">
            Raciones por defecto
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={newServings}
            onChange={(e) => setNewServings(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 4)))}
            className="mb-3 w-20 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setNewTitle("");
                setNewIngredients("");
                setNewInstructions("");
                setNewTags([]);
                setNewServings(4);
              }}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, etiqueta o ingrediente..."
          className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                !activeTag ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              }`}
            >
              Todas
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  activeTag === tag ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          {recipes.length === 0 ? "Aún no hay recetas." : "Ninguna receta coincide con el filtro."}
        </p>
      ) : (
      <ul className="grid gap-2 sm:grid-cols-2">
        {filteredRecipes.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  setViewingRecipe(r);
                  setViewServings(r.default_servings ?? 4);
                }}
                className="text-left"
              >
                <span className="font-medium text-emerald-900 hover:underline">{r.title}</span>
              </button>
              {r.tags && r.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {r.ingredients && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                  {r.ingredients}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => startEdit(r)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
                aria-label="Editar receta"
              >
                ✎
              </button>
              {!isExample(r.id) && (
                <button
                  type="button"
                  onClick={() => onRemoveRecipe(r.id)}
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Eliminar receta"
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      )}

      {viewingRecipe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setViewingRecipe(null)}
          role="presentation"
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Ver receta"
          >
            <div className="border-b border-emerald-100 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-emerald-900">
                  {viewingRecipe.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setViewingRecipe(null)}
                  className="shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              {viewingRecipe.tags && viewingRecipe.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {viewingRecipe.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500">Raciones:</span>
                {[2, 4, 6, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setViewServings(n)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      viewServings === n ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              {viewingRecipe.ingredients && (
                <section className="mb-4">
                  <h3 className="mb-2 text-sm font-semibold text-emerald-800">
                    Ingredientes{viewServings !== (viewingRecipe.default_servings ?? 4) ? ` (para ${viewServings} raciones)` : ""}
                  </h3>
                  <ul className="space-y-1 text-sm text-zinc-700">
                    {scaleIngredientLines(
                      viewingRecipe.ingredients,
                      viewingRecipe.default_servings ?? 4,
                      viewServings
                    )
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex flex-wrap">
                          <span className="mr-2 text-emerald-500">•</span>
                          {line}
                        </li>
                      ))}
                  </ul>
                </section>
              )}
              {viewingRecipe.instructions && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-emerald-800">
                    Pasos
                  </h3>
                  <ol className="list-inside list-decimal space-y-2 text-sm text-zinc-700">
                    {viewingRecipe.instructions
                      .split(/\n+/)
                      .map((step) => step.trim())
                      .filter(Boolean)
                      .map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                  </ol>
                </section>
              )}
              {!viewingRecipe.ingredients && !viewingRecipe.instructions && (
                <p className="text-sm text-zinc-500">
                  Sin ingredientes ni pasos. Haz clic en Editar para añadirlos.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-emerald-100 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setViewingRecipe(null);
                  startEdit(viewingRecipe);
                }}
                className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setViewingRecipe(null)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type GroceryItem = { id: string; label: string; fromPlan: boolean };

const GROCERY_CATEGORIES = [
  { key: "vegetables", label: "Verduras y frutas", keywords: ["lechuga", "tomate", "cebolla", "zanahoria", "ajo", "pimiento", "calabacín", "berenjena", "espinaca", "brócoli", "limón", "manzana", "plátano", "naranja", "pera", "uva", "fresa", "patata", "boniato", "apio", "pepino", "aguacate", "albahaca", "perejil", "cebollino"] },
  { key: "dairy", label: "Lácteos", keywords: ["leche", "yogur", "queso", "mantequilla", "nata", "crema", "mozzarella", "parmesano", "ricotta"] },
  { key: "meat", label: "Carne y pescado", keywords: ["pollo", "carne", "ternera", "cerdo", "pescado", "merluza", "salmón", "atún", "bacalao", "jamón", "bacon", "pechuga", "muslo"] },
  { key: "pantry", label: "Despensa", keywords: ["aceite", "sal", "pimienta", "arroz", "pasta", "harina", "azúcar", "vinagre", "salsa", "tomate triturado", "caldo", "legumbres", "lentejas", "garbanzos", "alubias", "pan", "tortilla", "cereal", "miel", "mostaza", "mayonesa", "aceituna", "almendra", "nuez"] },
] as const;

function getGroceryCategory(label: string): string {
  const lower = label.toLowerCase();
  for (const cat of GROCERY_CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat.key;
  }
  return "other";
}

function normalizeIngredientForGrouping(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();
  const match = s.match(
    /^(\d+([.,]\d+)?\s*(g|kg|ml|l|oz|lb|cups?|tbsp|tsp|dientes?|unidades?|bote|cucharada|cucharadita)?\s*[-–]?\s*)?(.+)$/
  );
  return match ? match[4].trim() : s;
}

function parseCountFromLabel(label: string): { baseLabel: string; count: number } {
  const m = label.match(/\s*\((\d+)\)\s*$/);
  if (m) {
    return { baseLabel: label.replace(/\s*\(\d+\)\s*$/, "").trim(), count: parseInt(m[1], 10) };
  }
  return { baseLabel: label, count: 1 };
}

function mergeGroceryItems(items: GroceryItem[]): GroceryItem[] {
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

function getGroceryItemsFromPlan(
  plan: PlanState,
  recipes: Recipe[],
  weekStart: Date
): GroceryItem[] {
  const weekDays = getWeekDates(weekStart);
  const items: GroceryItem[] = [];
  for (const meal of MEAL_LABELS) {
    for (const d of weekDays) {
      const key = slotKey(d.date, meal);
      const recipeId = plan[key];
      if (!recipeId) continue;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe?.ingredients) continue;
      const lines = recipe.ingredients.split(/\n/).map((s) => s.trim()).filter(Boolean);
      lines.forEach((line) => {
        items.push({ id: `plan-${key}-${line}`, label: line, fromPlan: true });
      });
    }
  }
  return mergeGroceryItems(items);
}

function GroceryListView({
  plan,
  recipes,
  manualItems,
  setManualItems,
  checkedIds,
  setCheckedIds,
  addManualItem,
}: {
  plan: PlanState;
  recipes: Recipe[];
  manualItems: { id: string; label: string }[];
  setManualItems: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  checkedIds: Set<string>;
  setCheckedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  addManualItem?: (label: string) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const weekStart = getWeekStart();
  const fromPlan = getGroceryItemsFromPlan(plan, recipes, weekStart);
  const manualAsItems: GroceryItem[] = manualItems.map((m) => ({
    ...m,
    fromPlan: false,
  }));
  const allItems: GroceryItem[] = mergeGroceryItems([...fromPlan, ...manualAsItems]);

  const categoryOrder = ["vegetables", "dairy", "meat", "pantry", "other"] as const;
  const categoryLabels: Record<string, string> = {
    vegetables: "Verduras y frutas",
    dairy: "Lácteos",
    meat: "Carne y pescado",
    pantry: "Despensa",
    other: "Otros",
  };
  const grouped = categoryOrder.map((key) => ({
    key,
    label: categoryLabels[key],
    items: allItems.filter((item) => getGroceryCategory(item.label) === key),
  })).filter((g) => g.items.length > 0);

  const toggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newItem.trim();
    if (!label) return;
    if (addManualItem) {
      addManualItem(label);
    } else {
      setManualItems((prev) => [...prev, { id: `m-${Date.now()}`, label }]);
    }
    setNewItem("");
  };

  const removeManual = (id: string) => {
    if (id.startsWith("merged-")) {
      const key = id.replace("merged-", "").replace(/-/g, " ");
      setManualItems((prev) =>
        prev.filter((i) => normalizeIngredientForGrouping(i.label) !== key)
      );
    } else {
      setManualItems((prev) => prev.filter((i) => i.id !== id));
    }
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const weekDays = getWeekDates(weekStart);
  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString("es", { month: "long" });

  const getExportText = () => {
    const lines = [
      "Lista de la compra - TableTime",
      `Semana del ${weekTitle}`,
      "",
      ...allItems.map((item) => {
        const checked = checkedIds.has(item.id);
        return `${checked ? "☑" : "☐"} ${item.label}`;
      }),
      "",
      "---",
      "TableTime",
    ];
    return lines.join("\n");
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getExportText());
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setCopyFeedback(false);
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([getExportText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compra-${weekDays[0].date.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const itemsHtml = allItems
      .map((item) => {
        const checked = checkedIds.has(item.id);
        return `<li style="text-decoration: ${checked ? "line-through" : "none"}; margin: 6px 0;">${checked ? "☑" : "☐"} ${escape(item.label)}</li>`;
      })
      .join("");
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Lista de la compra</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:400px;margin:0 auto;font-size:14px}h1{font-size:1.25rem;margin:0 0 8px}p{color:#555;margin:0 0 16px}ul{list-style:none;padding:0;margin:0}</style>
</head><body><h1>Lista de la compra - TableTime</h1><p>Semana del ${escape(weekTitle)}</p><ul>${itemsHtml}</ul></body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 500);
    }, 100);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-700">
          Generada a partir de tu plan de esta semana. Añade lo que falte y marca al comprar.
        </p>
        {allItems.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {copyFeedback ? "¡Copiado!" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={downloadTxt}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Descargar .txt
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Imprimir
            </button>
          </div>
        )}
      </div>

      <form onSubmit={addManual} className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Añadir producto (ej. Leche, Pan)"
          className="flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Añadir
        </button>
      </form>

      {allItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 py-8 text-center text-sm text-zinc-600">
          No hay nada aún. Asigna recetas con ingredientes en el Calendario o añade productos arriba.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {group.label}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const checked = checkedIds.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        checked
                          ? "border-emerald-100 bg-emerald-50/50 text-zinc-500 line-through"
                          : "border-emerald-100 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-emerald-300 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        aria-label={checked ? "Marcar como no comprado" : "Marcar como comprado"}
                      >
                        {checked ? "✓" : ""}
                      </button>
                      <span className="min-w-0 flex-1 text-sm">{item.label}</span>
                      {!item.fromPlan && (
                        <button
                          type="button"
                          onClick={() => removeManual(item.id)}
                          className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                          aria-label="Quitar"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionPlaceholder({
  activeTab,
  recipes,
  plan,
  setPlan,
  onAddRecipe,
  onRemoveRecipe,
  onUpdateRecipe,
  manualGroceryItems,
  setManualGroceryItems,
  groceryCheckedIds,
  setGroceryCheckedIds,
  themeDays,
  setThemeDays,
  addManualGroceryItem,
}: {
  activeTab: TabId;
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
  onAddRecipe: (title: string, ingredients?: string, instructions?: string, tags?: string[]) => void;
  onRemoveRecipe: (id: string) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  manualGroceryItems: { id: string; label: string }[];
  setManualGroceryItems: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  groceryCheckedIds: Set<string>;
  setGroceryCheckedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  themeDays: ThemeDays;
  setThemeDays: React.Dispatch<React.SetStateAction<ThemeDays>>;
  addManualGroceryItem?: (label: string) => void;
}) {
  if (activeTab === "calendar") {
    return (
      <div className="flex flex-col gap-4">
        <ThemeConfig
          themeDays={themeDays}
          setThemeDays={setThemeDays}
        />
        <CalendarWeekView
          recipes={recipes}
          plan={plan}
          setPlan={setPlan}
          themeDays={themeDays}
        />
      </div>
    );
  }

  if (activeTab === "recipes") {
    return (
      <RecipesView
        recipes={recipes}
        onAddRecipe={onAddRecipe}
        onRemoveRecipe={onRemoveRecipe}
        onUpdateRecipe={onUpdateRecipe}
      />
    );
  }

  return (
    <GroceryListView
      plan={plan}
      recipes={recipes}
      manualItems={manualGroceryItems}
      setManualItems={setManualGroceryItems}
      checkedIds={groceryCheckedIds}
      setCheckedIds={setGroceryCheckedIds}
      addManualItem={addManualGroceryItem}
    />
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("calendar");
  const {
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
    syncError,
    cloudUnavailable,
    isRemote,
    ensureError,
  } = useTableTimeData();

  if (!hasHydrated || syncLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-amber-50">
        <p className="text-zinc-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 px-4 py-10 font-sans text-zinc-900">
      {syncError && (
        <div className="mx-auto max-w-5xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">
          Error al guardar en la nube: {syncError}
        </div>
      )}
      {cloudUnavailable && (
        <div className="mx-auto max-w-5xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          No se pudo conectar con la nube. Las recetas se guardan solo en este dispositivo.
          {ensureError && (
            <span className="mt-1 block font-medium">Motivo: {ensureError}</span>
          )}
        </div>
      )}
      {isRemote && !syncError && (
        <div className="mx-auto max-w-5xl text-right text-xs text-emerald-700">
          Sincronizado con la nube
        </div>
      )}
      <main className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-emerald-900 sm:text-4xl">
              TableTime
            </h1>
            <p className="mt-2 max-w-xl text-sm sm:text-base text-zinc-700">
              Organiza los meals de tu familia sin estrés: calendario visual, recetas compartidas y
              lista de la compra inteligente en un solo lugar.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              Crear mi primer plan semanal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("recipes")}
              className="rounded-full border border-emerald-200 bg-white px-5 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Ver recetas de ejemplo
            </button>
          </div>
        </header>

        <nav className="flex gap-2 rounded-full bg-emerald-50 p-1 text-sm font-medium text-emerald-800 sm:max-w-md">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full px-4 py-2 transition ${
                  isActive
                    ? "bg-white shadow-sm"
                    : "bg-transparent hover:bg-emerald-100"
                }`}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="rounded-2xl bg-white/80 p-6 shadow-sm ring-1 ring-emerald-50">
          <SectionPlaceholder
            activeTab={activeTab}
            recipes={recipes}
            plan={plan}
            setPlan={setPlan}
            onAddRecipe={addRecipe}
            onRemoveRecipe={removeRecipe}
            onUpdateRecipe={updateRecipe}
            manualGroceryItems={manualGroceryItems}
            setManualGroceryItems={setManualGroceryItems}
            groceryCheckedIds={groceryCheckedIds}
            setGroceryCheckedIds={setGroceryCheckedIds}
            themeDays={themeDays}
            setThemeDays={setThemeDays}
            addManualGroceryItem={addManualGroceryItem}
          />
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-emerald-50">
            <h2 className="text-sm font-semibold text-emerald-800">
              1. Calendario de comidas
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              Ve tu semana de un vistazo con temas como <span className="font-medium">Pasta Tuesday</span> o{" "}
              <span className="font-medium">Kids Choice Night</span>. Cada slot tendrá su receta asignada.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-emerald-50">
            <h2 className="text-sm font-semibold text-emerald-800">
              2. Biblioteca de recetas
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              Guarda tus recetas favoritas, impórtalas desde cualquier web y etiquétalas como
              <span className="font-medium"> kid-friendly</span>,{" "}
              <span className="font-medium">rápidas</span> o{" "}
              <span className="font-medium">alta proteína</span>.
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-emerald-50">
            <h2 className="text-sm font-semibold text-emerald-800">
              3. Lista de la compra
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              Genera automáticamente la lista de la compra para toda la semana, compartida en tiempo
              real con tu pareja y peques.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-emerald-900 px-6 py-5 text-emerald-50">
          <h2 className="text-sm font-semibold">Progreso</h2>
          <p className="mt-2 text-sm text-emerald-100">
            <span className="font-medium">Calendario</span>,{" "}
            <span className="font-medium">Recetas</span> y{" "}
            <span className="font-medium">Lista de la compra</span> ya están conectados: planifica la semana, añade recetas con ingredientes y genera la lista al instante.
          </p>
        </section>
      </main>
    </div>
  );
}
