"use client";

import { useEffect, useState } from "react";

const MEAL_LABELS = ["Desayuno", "Comida", "Cena", "Snacks"] as const;
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const SLOT_STATUS_VALUES = ["leftovers", "skip", "eating_out"] as const;
const SLOT_STATUS_LABELS: Record<string, string> = {
  leftovers: "Sobras",
  skip: "Saltar",
  eating_out: "Fuera",
};
function isSlotStatus(v: string): boolean {
  return SLOT_STATUS_VALUES.includes(v as (typeof SLOT_STATUS_VALUES)[number]);
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekDates(from: Date): { date: Date; dayLabel: string; dateLabel: string }[] {
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

function slotKey(date: Date, meal: string): string {
  return `${date.toISOString().slice(0, 10)}-${meal}`;
}

const GROCERY_CATEGORIES = [
  { key: "vegetables", label: "Verduras y frutas", keywords: ["lechuga", "tomate", "cebolla", "zanahoria", "ajo", "pimiento", "limón", "patata", "huevo"] },
  { key: "dairy", label: "Lácteos", keywords: ["leche", "yogur", "queso", "mantequilla", "nata"] },
  { key: "meat", label: "Carne y pescado", keywords: ["pollo", "carne", "pescado", "cerdo"] },
  { key: "pantry", label: "Despensa", keywords: ["aceite", "sal", "arroz", "pasta", "harina", "caldo", "pan"] },
] as const;

function getCategory(label: string): string {
  const lower = label.toLowerCase();
  for (const cat of GROCERY_CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat.key;
  }
  return "other";
}

function normalizeLabel(label: string): string {
  let s = label.trim().toLowerCase();
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();
  const m = s.match(/^(\d+([.,]\d+)?\s*(g|kg|ml|bote)?\s*[-–]?\s*)?(.+)$/);
  return m ? m[4].trim() : s;
}

function mergeItems(
  fromPlan: { label: string }[],
  manual: { id: string; label: string }[],
  checkedIds: string[]
): { id: string; label: string; fromPlan: boolean; checked: boolean }[] {
  const byKey = new Map<string, { label: string; count: number; fromPlan: boolean }>();
  for (const item of fromPlan) {
    const key = normalizeLabel(item.label);
    const ex = byKey.get(key);
    if (ex) {
      ex.count += 1;
      if (item.label.length > ex.label.length) ex.label = item.label;
      ex.fromPlan = true;
    } else byKey.set(key, { label: item.label, count: 1, fromPlan: true });
  }
  for (const m of manual) {
    const key = normalizeLabel(m.label);
    const ex = byKey.get(key);
    if (ex) {
      ex.count += 1;
      if (m.label.length > ex.label.length) ex.label = m.label;
    } else byKey.set(key, { label: m.label, count: 1, fromPlan: false });
  }
  return Array.from(byKey.entries()).map(([key, { label, count, fromPlan }]) => {
    const id = `merged-${key.replace(/\s+/g, "-")}`;
    return {
      id,
      label: count > 1 ? `${label} (${count})` : label,
      fromPlan,
      checked: checkedIds.includes(id),
    };
  });
}

type SharedData = {
  householdName: string;
  share_plan: boolean;
  share_list: boolean;
  plan: Record<string, string>;
  recipes: { id: string; title: string; ingredients?: string }[];
  themeDays: Record<number, Record<string, string>>;
  manualItems: { id: string; label: string }[];
  groceryCheckedIds: string[];
};

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (cancelled) return;
      if (!p.token) {
        setError("Enlace inválido");
        setLoading(false);
        return;
      }
      fetch(`/api/share/${p.token}`)
        .then((res) => {
          if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "Error")));
          return res.json();
        })
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message || "Error al cargar");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50/60">
        <p className="text-teal-800">Cargando…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50/60 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="font-medium">{error ?? "Enlace inválido o expirado"}</p>
          <a href="/" className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  const weekStart = getWeekStart();
  const weekDays = getWeekDates(weekStart);
  const fromPlan: { label: string }[] = [];
  if (data.share_plan) {
    for (const meal of MEAL_LABELS) {
      for (const d of weekDays) {
        const key = slotKey(d.date, meal);
        const recipeId = data.plan[key];
        if (!recipeId || isSlotStatus(recipeId)) continue;
        const recipe = data.recipes.find((r) => r.id === recipeId);
        if (!recipe?.ingredients) continue;
        recipe.ingredients.split("\n").map((s) => s.trim()).filter(Boolean).forEach((line) => fromPlan.push({ label: line }));
      }
    }
  }
  const groceryItems = mergeItems(fromPlan, data.manualItems, data.groceryCheckedIds);
  const byCategory = groceryItems.reduce((acc, item) => {
    const cat = getCategory(item.label);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof groceryItems>);
  const categoryOrder = ["vegetables", "dairy", "meat", "pantry", "other"] as const;
  const categoryLabels: Record<string, string> = {
    vegetables: "Verduras y frutas",
    dairy: "Lácteos",
    meat: "Carne y pescado",
    pantry: "Despensa",
    other: "Otros",
  };

  const getRecipeTitle = (recipeId: string) => data.recipes.find((r) => r.id === recipeId)?.title ?? recipeId;
  const getSlotLabel = (value: string) =>
    isSlotStatus(value) ? SLOT_STATUS_LABELS[value] ?? value : getRecipeTitle(value);

  return (
    <div className="min-h-screen bg-teal-50/60 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-teal-900">TableTime · Compartido</h1>
          <p className="mt-1 text-sm text-zinc-600">{data.householdName} — solo lectura</p>
        </header>

        {data.share_plan && (
          <section className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-teal-800">
              Plan de la semana ({weekDays[0].date.getDate()} – {weekDays[6].date.getDate()} {weekDays[0].date.toLocaleDateString("es", { month: "long" })})
            </h2>
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-8 border-b border-teal-100 text-center text-xs">
                  <div className="p-2" />
                  {weekDays.map((d) => (
                    <div key={d.dayLabel} className="border-l border-teal-50 p-2">
                      <span className="font-medium text-teal-800">{d.dayLabel}</span>
                      <span className="block text-zinc-500">{d.dateLabel}</span>
                    </div>
                  ))}
                </div>
                {MEAL_LABELS.map((meal) => (
                  <div key={meal} className="grid grid-cols-8 border-b border-teal-50 text-xs last:border-b-0">
                    <div className="border-r border-teal-50 bg-teal-50/50 py-2 pl-2 font-medium text-teal-800">
                      {meal}
                    </div>
                    {weekDays.map((d) => {
                      const key = slotKey(d.date, meal);
                      const recipeId = data.plan[key];
                      return (
                        <div
                          key={key}
                          className="border-l border-teal-50 p-2 text-center text-zinc-700"
                        >
                          {recipeId ? getSlotLabel(recipeId) : "—"}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {data.share_list && groceryItems.length > 0 && (
          <section className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-teal-800">Lista de la compra</h2>
            <div className="space-y-4">
              {categoryOrder.map((key) => {
                const items = byCategory[key];
                if (!items?.length) return null;
                return (
                  <div key={key}>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase text-teal-700">
                      {categoryLabels[key] ?? key}
                    </h3>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className={`flex items-center gap-2 text-sm ${
                            item.checked ? "text-zinc-400 line-through" : "text-zinc-700"
                          }`}
                        >
                          <span className="text-teal-500">{item.checked ? "☑" : "☐"}</span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {data.share_list && groceryItems.length === 0 && (
          <p className="text-center text-sm text-zinc-500">No hay items en la lista.</p>
        )}

        <p className="text-center text-xs text-zinc-500">
          Vista de solo lectura. Para editar, pide acceso al hogar en TableTime.
        </p>
      </div>
    </div>
  );
}
