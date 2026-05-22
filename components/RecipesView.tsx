"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/sync/use-tabletime-data";
import { SUGGESTED_TAGS } from "@/lib/constants";
import { filterRecipes, isExample } from "@/lib/utils/recipes";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

export function RecipesView({
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
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyFamilyApproved, setOnlyFamilyApproved] = useState(false);
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
      onAddRecipe(title, newIngredients.trim() || undefined, newInstructions.trim() || undefined, newTags.length > 0 ? newTags : undefined, newServings);
    }
    setNewTitle(""); setNewIngredients(""); setNewInstructions(""); setNewTags([]); setNewServings(4); setShowForm(false);
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
      const res = await fetch("/api/import-recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Error al importar"); return; }
      setNewTitle(data.title ?? ""); setNewIngredients(data.ingredients ?? ""); setNewInstructions(data.instructions ?? "");
      setShowImport(false); setImportUrl(""); setShowForm(true);
    } catch {
      setImportError("No se pudo conectar. Verifica la URL.");
    } finally {
      setImportLoading(false);
    }
  };

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();
  const filteredRecipes = filterRecipes(recipes, search, activeTag, {
    onlyFavorites: onlyFavorites || undefined,
    onlyFamilyApproved: onlyFamilyApproved || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-4 py-3">
        <p className="text-sm font-medium text-teal-800">
          {recipes.length} receta{recipes.length !== 1 ? "s" : ""} en tu biblioteca
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowImport(true)} className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-50">
            Importar desde URL
          </button>
          <button type="button" onClick={() => setShowForm(true)} className="rounded-full bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700">
            + Añadir receta
          </button>
        </div>
      </div>

      {showImport && (
        <form onSubmit={handleImportSubmit} className="rounded-xl border-l-4 border-l-teal-400 border border-teal-200 bg-teal-300/10 p-4">
          <label className="mb-2 block text-xs font-medium text-teal-800">Pegar URL de la receta</label>
          <p className="mb-3 text-xs text-zinc-600">Funciona con la mayoría de blogs y webs que usen datos estructurados (schema.org).</p>
          <div className="flex gap-2">
            <input type="url" value={importUrl} onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }} placeholder="https://ejemplo.com/receta-pasta..." className="flex-1 rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" disabled={importLoading} />
            <button type="submit" disabled={importLoading || !importUrl.trim()} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50">
              {importLoading ? "Importando…" : "Importar"}
            </button>
          </div>
          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
          <button type="button" onClick={() => { setShowImport(false); setImportUrl(""); setImportError(null); }} className="mt-2 text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border-l-4 border-l-teal-600 border border-teal-200 bg-teal-50/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-teal-900">{editingId ? "Editar receta" : "Nueva receta"}</h3>
          <label className="mb-2 block text-xs font-medium text-teal-800">Nombre de la receta</label>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Lentejas con chorizo" className="mb-3 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" autoFocus />
          <label className="mb-2 block text-xs font-medium text-teal-800">Ingredientes (opcional)</label>
          <textarea value={newIngredients} onChange={(e) => setNewIngredients(e.target.value)} placeholder="Uno por línea: 200g lentejas, 1 chorizo..." rows={3} className="mb-3 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <label className="mb-2 block text-xs font-medium text-teal-800">Pasos (opcional)</label>
          <textarea value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)} placeholder="1. Sofreír la cebolla..." rows={3} className="mb-3 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <label className="mb-2 block text-xs font-medium text-teal-800">Etiquetas (opcional)</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => (
              <button key={tag} type="button" onClick={() => setNewTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${newTags.includes(tag) ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-800 hover:bg-teal-200"}`}>
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newTags.filter((t) => !(SUGGESTED_TAGS as readonly string[]).includes(t)).join(", ")}
            onChange={(e) => {
              const val = e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
              const suggested = newTags.filter((t) => (SUGGESTED_TAGS as readonly string[]).includes(t));
              setNewTags([...suggested, ...val]);
            }}
            placeholder="Otras etiquetas (separadas por coma)"
            className="mb-3 w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
          />
          <label className="mb-2 block text-xs font-medium text-teal-800">Raciones por defecto</label>
          <input type="number" min={1} max={24} value={newServings} onChange={(e) => setNewServings(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 4)))} className="mb-3 w-20 rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Guardar</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setNewTitle(""); setNewIngredients(""); setNewInstructions(""); setNewTags([]); setNewServings(4); }} className="rounded-lg border border-teal-200 px-4 py-2 text-sm text-teal-700 hover:bg-teal-50">Cancelar</button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, etiqueta o ingrediente..." className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setActiveTag(null)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${!activeTag ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-800 hover:bg-teal-200"}`}>Todas</button>
            {allTags.map((tag) => (
              <button key={tag} type="button" onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${activeTag === tag ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-800 hover:bg-teal-200"}`}>{tag}</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Filtros:</span>
          <button type="button" onClick={() => setOnlyFavorites((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${onlyFavorites ? "bg-amber-200 text-amber-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>♥ Favoritas</button>
          <button type="button" onClick={() => setOnlyFamilyApproved((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${onlyFamilyApproved ? "bg-teal-200 text-teal-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>Family approved</button>
        </div>
      </div>

      {filteredRecipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          {recipes.length === 0 ? "Aún no hay recetas." : "Ninguna receta coincide con el filtro."}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredRecipes.map((r, idx) => (
            <li key={r.id} className={`flex items-center justify-between gap-3 rounded-lg border border-teal-100 px-4 py-3 shadow-sm ${idx % 3 === 0 ? "border-l-4 border-l-teal-600 bg-teal-50/60" : idx % 3 === 1 ? "border-l-4 border-l-teal-400 bg-teal-300/10" : "border-l-4 border-l-amber-600 bg-amber-50/60"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleRecipePatch(r.id, { is_favorite: !r.is_favorite })} className="shrink-0 rounded p-0.5 text-lg leading-none transition hover:scale-110" aria-label={r.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}>
                    <span className={r.is_favorite ? "text-amber-500" : "text-zinc-300"}>♥</span>
                  </button>
                  <button type="button" onClick={() => { setViewingRecipe(r); setViewServings(r.default_servings ?? 4); }} className="text-left">
                    <span className="font-medium text-teal-900 hover:underline">{r.title}</span>
                  </button>
                  {r.family_approved && <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">Family approved</span>}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={(e) => { e.stopPropagation(); handleRecipePatch(r.id, { rating: r.rating === n ? null : n }); }} className="rounded p-0 text-amber-400/80 hover:text-amber-500" aria-label={`${n} estrella${n > 1 ? "s" : ""}`}>
                      <span className={r.rating != null && n <= r.rating ? "text-amber-400" : "text-zinc-300"}>★</span>
                    </button>
                  ))}
                </div>
                {r.tags && r.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.tags.map((t) => <span key={t} className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">{t}</span>)}
                  </div>
                )}
                {r.ingredients && <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{r.ingredients}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(r)} className="rounded-full p-1.5 text-zinc-400 hover:bg-teal-50 hover:text-teal-600" aria-label="Editar receta">✎</button>
                {!isExample(r.id) && <button type="button" onClick={() => onRemoveRecipe(r.id)} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600" aria-label="Eliminar receta">✕</button>}
              </div>
            </li>
          ))}
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
        />
      )}
    </div>
  );
}
