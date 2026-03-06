"use client";

import { useEffect, useState } from "react";

const TABS = [
  { id: "calendar", label: "Calendario" },
  { id: "recipes", label: "Recetas" },
  { id: "grocery", label: "Lista de la compra" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MEAL_LABELS = ["Desayuno", "Comida", "Cena"] as const;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Recipe = { id: string; title: string; ingredients?: string };

const INITIAL_RECIPES: Recipe[] = [
  { id: "1", title: "Pasta con tomate", ingredients: "400g pasta\n1 bote tomate triturado\n2 dientes de ajo\nAceite de oliva\nAlbahaca" },
  { id: "2", title: "Tacos de pollo", ingredients: "500g pechuga de pollo\nTortillas de maíz\nLechuga\nTomate\nQueso rallado\nCrema ácida" },
  { id: "3", title: "Sopa de verduras", ingredients: "Zanahoria\nApio\nCebolla\nCalabacín\nCaldo de verduras\nFideos finos" },
  { id: "4", title: "Ensalada César", ingredients: "Lechuga romana\nPollo a la plancha\nPan tostado\nParmesano\nSalsa César" },
  { id: "5", title: "Arroz con pollo", ingredients: "300g arroz\n400g pollo\n1 cebolla\nPimiento\nGuisantes\nAzafrán" },
  { id: "6", title: "Huevos revueltos", ingredients: "6 huevos\nMantequilla\nSal y pimienta" },
  { id: "7", title: "Pizza casera", ingredients: "Masa de pizza\nTomate frito\nMozzarella\nAlbahaca\nOregano" },
  { id: "8", title: "Pescado al horno", ingredients: "4 filetes de merluza\nLimón\nAjo\nAceite de oliva\nPerejil" },
];

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

const STORAGE_KEY = "tabletime-v1";

function loadStored(): {
  recipes: Recipe[];
  plan: PlanState;
  manualGroceryItems: { id: string; label: string }[];
  groceryCheckedIds: string[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      recipes?: Recipe[];
      plan?: PlanState;
      manualGroceryItems?: { id: string; label: string }[];
      groceryCheckedIds?: string[];
    };
    if (!data || typeof data !== "object") return null;
    return {
      recipes: Array.isArray(data.recipes) ? data.recipes : [],
      plan: data.plan && typeof data.plan === "object" ? data.plan : {},
      manualGroceryItems: Array.isArray(data.manualGroceryItems)
        ? data.manualGroceryItems
        : [],
      groceryCheckedIds: Array.isArray(data.groceryCheckedIds)
        ? data.groceryCheckedIds
        : [],
    };
  } catch {
    return null;
  }
}

function saveStored(payload: {
  recipes: Recipe[];
  plan: PlanState;
  manualGroceryItems: { id: string; label: string }[];
  groceryCheckedIds: string[];
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function CalendarWeekView({
  recipes,
  plan,
  setPlan,
}: {
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
}) {
  const [weekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  });

  const [openSlot, setOpenSlot] = useState<{ date: Date; meal: string } | null>(null);

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

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm font-medium text-emerald-800">
        Semana del {weekTitle}
      </p>
      <div className="min-w-[600px] rounded-xl border border-emerald-100 bg-white">
        <div className="grid grid-cols-8 border-b border-emerald-100">
          <div className="p-2 text-xs font-semibold text-zinc-500" />
          {weekDays.map((d) => (
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
            {weekDays.map((d) => {
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
                    <button
                      type="button"
                      onClick={() => setOpenSlot({ date: d.date, meal })}
                      className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 px-2 py-1.5 text-xs text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      Añadir
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {openSlot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpenSlot(null)}
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
            </div>
            <ul className="max-h-[50vh] overflow-y-auto">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => assignRecipe(r.id)}
                    className="w-full px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-emerald-50"
                  >
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-emerald-100 px-4 py-2">
              <button
                type="button"
                onClick={() => setOpenSlot(null)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipesView({
  recipes,
  onAddRecipe,
  onRemoveRecipe,
}: {
  recipes: Recipe[];
  onAddRecipe: (title: string, ingredients?: string) => void;
  onRemoveRecipe: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIngredients, setNewIngredients] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onAddRecipe(title, newIngredients.trim() || undefined);
    setNewTitle("");
    setNewIngredients("");
    setShowForm(false);
  };

  const isExample = (id: string) => !id.startsWith("u-");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-700">
          {recipes.length} receta{recipes.length !== 1 ? "s" : ""} en tu biblioteca
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          + Añadir receta
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4"
        >
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
                setNewTitle("");
                setNewIngredients("");
              }}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {recipes.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-4 py-3"
          >
            <div>
              <span className="font-medium text-emerald-900">{r.title}</span>
              {r.ingredients && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                  {r.ingredients}
                </p>
              )}
            </div>
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
          </li>
        ))}
      </ul>
    </div>
  );
}

type GroceryItem = { id: string; label: string; fromPlan: boolean };

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
      lines.forEach((line, i) => {
        items.push({ id: `plan-${key}-${i}`, label: line, fromPlan: true });
      });
    }
  }
  return items;
}

function GroceryListView({
  plan,
  recipes,
  manualItems,
  setManualItems,
  checkedIds,
  setCheckedIds,
}: {
  plan: PlanState;
  recipes: Recipe[];
  manualItems: { id: string; label: string }[];
  setManualItems: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  checkedIds: Set<string>;
  setCheckedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const [newItem, setNewItem] = useState("");
  const weekStart = getWeekStart();
  const fromPlan = getGroceryItemsFromPlan(plan, recipes, weekStart);
  const allItems: GroceryItem[] = [
    ...fromPlan,
    ...manualItems.map((m) => ({ ...m, fromPlan: false })),
  ];

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
    setManualItems((prev) => [...prev, { id: `m-${Date.now()}`, label }]);
    setNewItem("");
  };

  const removeManual = (id: string) => {
    setManualItems((prev) => prev.filter((i) => i.id !== id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-700">
        Generada a partir de tu plan de esta semana. Añade lo que falte y marca al comprar.
      </p>

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
        <ul className="space-y-1">
          {allItems.map((item) => {
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
  manualGroceryItems,
  setManualGroceryItems,
  groceryCheckedIds,
  setGroceryCheckedIds,
}: {
  activeTab: TabId;
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
  onAddRecipe: (title: string, ingredients?: string) => void;
  onRemoveRecipe: (id: string) => void;
  manualGroceryItems: { id: string; label: string }[];
  setManualGroceryItems: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  groceryCheckedIds: Set<string>;
  setGroceryCheckedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  if (activeTab === "calendar") {
    return (
      <CalendarWeekView recipes={recipes} plan={plan} setPlan={setPlan} />
    );
  }

  if (activeTab === "recipes") {
    return (
      <RecipesView
        recipes={recipes}
        onAddRecipe={onAddRecipe}
        onRemoveRecipe={onRemoveRecipe}
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
    />
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("calendar");
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [plan, setPlan] = useState<PlanState>({});
  const [manualGroceryItems, setManualGroceryItems] = useState<
    { id: string; label: string }[]
  >([]);
  const [groceryCheckedIds, setGroceryCheckedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      if (stored.recipes.length > 0) setRecipes(stored.recipes);
      if (Object.keys(stored.plan).length > 0) setPlan(stored.plan);
      if (stored.manualGroceryItems.length > 0)
        setManualGroceryItems(stored.manualGroceryItems);
      if (stored.groceryCheckedIds.length > 0)
        setGroceryCheckedIds(new Set(stored.groceryCheckedIds));
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    saveStored({
      recipes,
      plan,
      manualGroceryItems,
      groceryCheckedIds: [...groceryCheckedIds],
    });
  }, [hasHydrated, recipes, plan, manualGroceryItems, groceryCheckedIds]);

  const addRecipe = (title: string, ingredients?: string) => {
    const id = `u-${Date.now()}`;
    setRecipes((prev) => [...prev, { id, title, ingredients }]);
  };

  const removeRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setPlan((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === id) delete next[k];
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 px-4 py-10 font-sans text-zinc-900">
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
            <button className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700">
              Crear mi primer plan semanal
            </button>
            <button className="rounded-full border border-emerald-200 bg-white px-5 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50">
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
            manualGroceryItems={manualGroceryItems}
            setManualGroceryItems={setManualGroceryItems}
            groceryCheckedIds={groceryCheckedIds}
            setGroceryCheckedIds={setGroceryCheckedIds}
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
