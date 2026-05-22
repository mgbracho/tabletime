"use client";

import { useState, useEffect } from "react";
import type { Recipe, PlanState, ThemeDays } from "@/lib/sync/use-tabletime-data";
import type { HouseholdMember } from "@/lib/hooks/use-household-profile";
import {
  MEAL_LABELS,
  MealType,
  DAY_NAMES,
  isSlotStatus,
  SLOT_STATUS_LABELS,
} from "@/lib/constants";
import {
  slotKey,
  getWeekDates,
  getWeekStart,
  getMonthGrid,
  getMonthStart,
  printPlanToPdf,
} from "@/lib/utils/calendar";
import { filterRecipes, getRecipeConflicts } from "@/lib/utils/recipes";

type CalendarViewMode = "week" | "day" | "month";

export function CalendarWeekView({
  recipes,
  plan,
  setPlan,
  themeDays,
  onViewRecipe,
  onEditThemes,
  members = [],
  visibleMeals = [...MEAL_LABELS],
}: {
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
  themeDays: ThemeDays;
  onViewRecipe?: (recipe: Recipe) => void;
  onEditThemes?: () => void;
  members?: HouseholdMember[];
  visibleMeals?: readonly MealType[];
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [focusedDate, setFocusedDate] = useState<Date>(() => new Date());
  const [monthStart, setMonthStart] = useState<Date>(() => getMonthStart(new Date()));
  const [openSlot, setOpenSlot] = useState<{ date: Date; meal: string } | null>(null);
  const [openSlotMenu, setOpenSlotMenu] = useState<{ date: Date; meal: string; key: string } | null>(null);
  const [swapSlot, setSwapSlot] = useState<{ date: Date; meal: string; currentRecipeId: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTag, setPickerTag] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState<"day" | "week" | null>(null);
  const [clearDayIndex, setClearDayIndex] = useState<number | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setViewMode("day");
  }, []);

  const weekDays = getWeekDates(weekStart);
  const today = new Date();
  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString("es", { month: "long" });

  const getRecipeTitle = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.title ?? recipeId;

  const assignRecipe = (recipeId: string) => {
    if (!openSlot) return;
    setPlan((prev) => ({ ...prev, [slotKey(openSlot.date, openSlot.meal)]: recipeId }));
    setOpenSlot(null);
  };

  const goToPrevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const goToNextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };

  const copyFromPreviousWeek = () => {
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevDays = getWeekDates(prevStart);
    setPlan((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 7; i++) {
        for (const meal of MEAL_LABELS) {
          const recipeId = prev[slotKey(prevDays[i].date, meal)];
          if (recipeId) next[slotKey(weekDays[i].date, meal)] = recipeId;
        }
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, sourceKey: string, recipeId: string) => {
    e.dataTransfer.setData("application/slot-key", sourceKey);
    e.dataTransfer.setData("application/recipe-id", recipeId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKey(targetKey);
  };
  const handleDragLeave = () => setDragOverKey(null);
  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOverKey(null);
    const sourceKey = e.dataTransfer.getData("application/slot-key");
    const recipeId = e.dataTransfer.getData("application/recipe-id");
    if (!sourceKey || !recipeId) return;
    setPlan((prev) => {
      const next = { ...prev };
      next[targetKey] = recipeId;
      if (sourceKey !== targetKey) delete next[sourceKey];
      return next;
    });
  };
  const handleDragEnd = () => setDragOverKey(null);

  const clearDay = (dayIndex: number) => {
    setPlan((prev) => {
      const next = { ...prev };
      for (const m of MEAL_LABELS) delete next[slotKey(weekDays[dayIndex].date, m)];
      return next;
    });
    setClearConfirm(null);
    setClearDayIndex(null);
  };
  const clearWeek = () => {
    setPlan((prev) => {
      const next = { ...prev };
      for (const d of weekDays) for (const m of MEAL_LABELS) delete next[slotKey(d.date, m)];
      return next;
    });
    setClearConfirm(null);
  };
  const runClearConfirm = () => {
    if (clearConfirm === "week") clearWeek();
    else if (clearConfirm === "day" && clearDayIndex !== null) clearDay(clearDayIndex);
  };

  return (
    <div className="overflow-x-auto">
      {/* View mode selector */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Vista</span>
        <div className="inline-flex rounded-full bg-teal-50 p-0.5">
          {(["week", "day", "month"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded-full px-3 py-1 text-xs font-medium transition ${viewMode === mode ? "bg-white text-teal-900 shadow-sm" : "text-teal-700 hover:bg-teal-100"}`}>
              {mode === "week" ? "Semana" : mode === "day" ? "Día" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {viewMode === "week" && (
            <>
              <button type="button" onClick={goToPrevWeek} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">← Anterior</button>
              <span className="text-sm font-medium text-teal-800">Semana del {weekTitle}</span>
              <button type="button" onClick={goToNextWeek} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">Siguiente →</button>
            </>
          )}
          {viewMode === "day" && (
            <>
              <button type="button" onClick={() => { const d = new Date(focusedDate); d.setDate(d.getDate() - 1); setFocusedDate(d); }} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">← Día anterior</button>
              <span className="text-sm font-medium text-teal-800">{focusedDate.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <button type="button" onClick={() => { const d = new Date(focusedDate); d.setDate(d.getDate() + 1); setFocusedDate(d); }} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">Siguiente día →</button>
            </>
          )}
          {viewMode === "month" && (
            <>
              <button type="button" onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() - 1); setMonthStart(d); }} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">← Mes anterior</button>
              <span className="text-sm font-medium text-teal-800">{monthStart.toLocaleDateString("es", { month: "long", year: "numeric" })}</span>
              <button type="button" onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); setMonthStart(d); }} className="rounded-lg border border-teal-200 px-2 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">Siguiente mes →</button>
            </>
          )}
        </div>
        {viewMode === "week" && (
          <div className="relative">
            <button type="button" onClick={() => setMoreMenuOpen((o) => !o)} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">Más ▾</button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {onEditThemes && (
                    <>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50" onClick={() => { onEditThemes(); setMoreMenuOpen(false); }}>Editar temas</button>
                      <div className="my-1 border-t border-zinc-100" />
                    </>
                  )}
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100" onClick={() => { copyFromPreviousWeek(); setMoreMenuOpen(false); }}>Copiar semana anterior</button>
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => { setClearConfirm("week"); setMoreMenuOpen(false); }}>Borrar semana actual</button>
                  <div className="my-1 border-t border-zinc-100" />
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm text-teal-700 hover:bg-teal-50" onClick={() => { printPlanToPdf(plan, recipes, themeDays, visibleMeals); setMoreMenuOpen(false); }}>Imprimir / PDF</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Day view */}
      {viewMode === "day" && (
        <div className="w-full max-w-md rounded-xl border border-teal-200 bg-white shadow-sm ring-1 ring-teal-100">
          <div className="border-b border-teal-200 bg-gradient-to-r from-teal-50 to-teal-100/80 px-4 py-2">
            <span className="text-sm font-semibold text-teal-800">{focusedDate.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          {visibleMeals.map((meal) => {
            const key = slotKey(focusedDate, meal);
            const slotValue = plan[key];
            const recipeId = isSlotStatus(slotValue) ? null : slotValue;
            const dayIndex = (focusedDate.getDay() + 6) % 7;
            const slotTheme = themeDays[dayIndex]?.[meal as MealType];
            return (
              <div key={meal} className="flex items-center gap-3 border-b border-teal-50 px-4 py-3 last:border-b-0">
                <span className="w-24 shrink-0 text-sm font-medium text-teal-800">{meal}</span>
                <div className="min-h-[44px] flex-1 flex items-center gap-2 rounded-lg border border-teal-50 px-3 py-2 hover:bg-teal-50/50">
                  {recipeId ? (
                    <>
                      <button type="button" onClick={() => { const recipe = recipes.find((r) => r.id === recipeId); if (recipe && onViewRecipe) onViewRecipe(recipe); }} className="flex-1 text-left text-sm font-medium text-teal-900 hover:underline focus:outline-none focus:ring-1 focus:ring-teal-400 rounded">
                        {getRecipeTitle(recipeId)}
                      </button>
                      <button type="button" onClick={() => setOpenSlotMenu({ date: new Date(focusedDate), meal, key })} className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Opciones del hueco">⋯</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setOpenSlotMenu({ date: new Date(focusedDate), meal, key })} className="flex-1 text-left">
                      <span className={`block text-sm ${isSlotStatus(slotValue) ? "font-medium text-zinc-600" : slotTheme ? "text-amber-700" : "text-zinc-400 italic"}`}>
                        {isSlotStatus(slotValue) ? SLOT_STATUS_LABELS[slotValue] : slotTheme ? slotTheme : "Vacío"}
                      </span>
                    </button>
                  )}
                </div>
                {recipeId && slotTheme && <span className="text-xs text-amber-600">Tema: {slotTheme}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-teal-200 bg-white p-2 shadow-sm ring-1 ring-teal-100">
          <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold text-teal-800">
            {DAY_NAMES.map((d) => <div key={d} className="rounded bg-teal-100/80 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {getMonthGrid(monthStart).map((cell) => (
              <button key={cell.date.toISOString()} type="button" onClick={() => { setWeekStart(getWeekDates(cell.date)[0]?.date ?? cell.date); setViewMode("week"); }} className={`min-h-[52px] rounded p-1.5 text-left text-sm ${cell.isCurrentMonth ? "bg-white text-zinc-800 hover:bg-teal-50" : "bg-zinc-50 text-zinc-400"}`}>
                <span className="font-medium">{cell.dateLabel}</span>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {visibleMeals.map((meal) => {
                    const v = plan[slotKey(cell.date, meal)];
                    if (!v) return null;
                    return <span key={meal} className={`inline-block h-1.5 w-1.5 rounded-full ${isSlotStatus(v) ? "bg-zinc-400" : "bg-teal-500"}`} title={isSlotStatus(v) ? SLOT_STATUS_LABELS[v] : getRecipeTitle(v)} />;
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Week view */}
      {viewMode === "week" && (
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] md:min-w-[700px] rounded-2xl border border-teal-100 bg-white/95 shadow-sm ring-1 ring-teal-50">
            <div className="grid grid-cols-8 border-b border-teal-100 bg-gradient-to-r from-teal-50/80 via-teal-50 to-teal-50/80">
              <div className="p-2 text-[11px] font-semibold uppercase tracking-wide text-teal-700" />
              {weekDays.map((d) => {
                const isToday = d.date.toDateString() === today.toDateString();
                return (
                  <div key={d.date.toISOString()} className={`border-l border-teal-100 px-2 py-2 text-center text-xs ${isToday ? "bg-white shadow-sm" : ""}`}>
                    <span className="block text-[11px] font-medium text-teal-800">{d.dayLabel}</span>
                    <span className={`text-xs ${isToday ? "text-teal-900 font-semibold" : "text-teal-700/80"}`}>{d.dateLabel}</span>
                  </div>
                );
              })}
            </div>
            {visibleMeals.map((meal, mealIndex) => (
              <div key={meal} className={`grid grid-cols-8 border-b border-teal-50 last:border-b-0 ${mealIndex % 2 === 0 ? "bg-teal-25/40" : "bg-white"}`}>
                <div className="flex items-center border-r border-teal-50 bg-teal-50/70 px-2 py-1.5 text-[11px] font-medium text-teal-900">{meal}</div>
                {weekDays.map((d, dayIndex) => {
                  const key = slotKey(d.date, meal);
                  const slotValue = plan[key];
                  const recipeId = isSlotStatus(slotValue) ? null : slotValue;
                  const isDragOver = dragOverKey === key;
                  const isTodayColumn = d.date.toDateString() === today.toDateString();
                  return (
                    <div
                      key={key}
                      className={`flex min-h-[40px] items-center justify-center border-l border-teal-50 px-1.5 py-1.5 transition-colors ${isDragOver ? "bg-teal-100 ring-1 ring-teal-300" : isTodayColumn ? "bg-teal-50/70" : "bg-white/0 hover:bg-teal-50/60"}`}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, key)}
                      onClick={() => {
                        if (recipeId) { const recipe = recipes.find((r) => r.id === recipeId); if (recipe && onViewRecipe) onViewRecipe(recipe); }
                        else setOpenSlotMenu({ date: d.date, meal, key });
                      }}
                    >
                      <div className={`group flex w-full cursor-pointer flex-col items-center justify-center gap-0.5 ${recipeId ? "cursor-grab active:cursor-grabbing" : ""}`} draggable={!!recipeId} onDragStart={recipeId ? (e) => handleDragStart(e, key, recipeId) : undefined} onDragEnd={recipeId ? handleDragEnd : undefined}>
                        <div className="flex w-full items-center justify-center gap-1">
                          <span className={`px-2 text-center text-xs leading-snug ${recipeId ? "font-medium text-teal-900" : isSlotStatus(slotValue) ? "font-medium text-zinc-600" : themeDays[dayIndex]?.[meal] ? "text-amber-700" : "text-zinc-400 italic"}`}>
                            {recipeId ? (
                              <button type="button" onClick={(e) => { e.stopPropagation(); const recipe = recipes.find((r) => r.id === recipeId); if (recipe && onViewRecipe) onViewRecipe(recipe); }} className="hover:underline focus:outline-none focus:ring-1 focus:ring-teal-400 rounded">
                                {getRecipeTitle(recipeId)}
                              </button>
                            ) : (
                              isSlotStatus(slotValue) ? SLOT_STATUS_LABELS[slotValue] : themeDays[dayIndex]?.[meal] ? themeDays[dayIndex][meal] : "Vacío"
                            )}
                          </span>
                          {recipeId && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOpenSlotMenu({ date: d.date, meal, key }); }} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 text-xs leading-none" aria-label="Opciones del hueco">⋯</button>
                          )}
                          {recipeId && (() => {
                            const recipe = recipes.find((r) => r.id === recipeId);
                            const conflicts = recipe ? getRecipeConflicts(recipe, members) : [];
                            if (conflicts.length === 0) return null;
                            return <span className="shrink-0 text-amber-500" title={conflicts.map((c) => `No apto para ${c.displayName}: falta ${c.missingTags.join(", ")}`).join("\n")} aria-label="Aviso: receta con posible conflicto dietético">⚠</span>;
                          })()}
                        </div>
                        {recipeId && themeDays[dayIndex]?.[meal] && (
                          <span className="text-[10px] font-medium text-amber-600">{themeDays[dayIndex][meal]}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear confirm dialog */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="clear-confirm-title">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 id="clear-confirm-title" className="text-sm font-semibold text-zinc-900">
              {clearConfirm === "week" ? "¿Borrar toda la semana?" : clearDayIndex !== null ? `¿Borrar el ${weekDays[clearDayIndex].dayLabel} ${weekDays[clearDayIndex].dateLabel}?` : "Confirmar"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">{clearConfirm === "week" ? "Se quitarán todas las recetas de la semana actual." : "Se quitarán Desayuno, Comida, Cena y Snacks de ese día."}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setClearConfirm(null); setClearDayIndex(null); }} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancelar</button>
              <button type="button" onClick={runClearConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Slot menu */}
      {openSlotMenu && (() => {
        const { date, meal, key } = openSlotMenu;
        const slotValue = plan[key];
        const recipeId = isSlotStatus(slotValue) ? null : slotValue;
        const weekdayIndex = (date.getDay() + 6) % 7;
        const slotTheme = themeDays[weekdayIndex]?.[meal as MealType];
        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 md:items-center" role="presentation" onClick={() => setOpenSlotMenu(null)}>
            <div className="mx-4 w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Acciones del hueco">
              <p className="text-xs font-medium text-teal-800">{date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })} · {meal}</p>
              {slotTheme && <p className="mt-0.5 text-[11px] text-amber-600">Tema: {slotTheme}</p>}
              <div className="mt-3 space-y-2">
                <button type="button" className="w-full rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700" onClick={() => { setOpenSlot({ date, meal }); setOpenSlotMenu(null); }}>
                  {recipeId ? "Cambiar receta" : "Añadir receta"}
                </button>
                <div className="flex flex-wrap gap-1">
                  {(["leftovers", "skip"] as const).map((status) => (
                    <button key={status} type="button" className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-100" onClick={() => { setPlan((prev) => ({ ...prev, [key]: status })); setOpenSlotMenu(null); }}>
                      {SLOT_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
                {(recipeId || slotValue) && (
                  <button type="button" className="w-full rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => { setPlan((prev) => { const next = { ...prev }; delete next[key]; return next; }); setOpenSlotMenu(null); }}>
                    Eliminar receta
                  </button>
                )}
              </div>
              <button type="button" className="mt-3 w-full text-center text-xs text-zinc-500 hover:underline" onClick={() => setOpenSlotMenu(null)}>Cerrar</button>
            </div>
          </div>
        );
      })()}

      {/* Swap slot dialog */}
      {swapSlot && (() => {
        const weekdayIndex = (swapSlot.date.getDay() + 6) % 7;
        const slotTheme = themeDays[weekdayIndex]?.[swapSlot.meal as MealType] ?? "";
        const themeWords = slotTheme.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        const matchesTheme = (r: Recipe) => themeWords.length > 0 && themeWords.some((w) => r.title.toLowerCase().includes(w) || (r.tags ?? []).some((t) => t.toLowerCase().includes(w)));
        const others = recipes.filter((r) => r.id !== swapSlot.currentRecipeId);
        const sortByConflicts = (a: Recipe, b: Recipe) => getRecipeConflicts(a, members).length - getRecipeConflicts(b, members).length;
        const alternatives = [
          ...others.filter(matchesTheme).sort(sortByConflicts),
          ...others.filter((r) => !matchesTheme(r)).sort(sortByConflicts),
        ].slice(0, 5);
        const key = slotKey(swapSlot.date, swapSlot.meal);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSwapSlot(null)} role="presentation">
            <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cambiar receta">
              <div className="border-b border-teal-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-teal-900">Cambiar receta</h3>
                <p className="text-xs text-zinc-500">{swapSlot.date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })} · {swapSlot.meal}</p>
                {slotTheme && <p className="mt-1 text-xs font-medium text-amber-600">Tema: {slotTheme}</p>}
              </div>
              <ul className="max-h-[50vh] overflow-y-auto">
                {alternatives.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-zinc-500">No hay otras recetas para sugerir.</li>
                ) : alternatives.map((r) => {
                  const conflicts = getRecipeConflicts(r, members);
                  const matches = themeWords.length > 0 && matchesTheme(r);
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => { setPlan((prev) => ({ ...prev, [key]: r.id })); setSwapSlot(null); }} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-teal-50">
                        <span>{r.title}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {matches && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">tema</span>}
                          {conflicts.length > 0 && <span className="text-amber-500" title={conflicts.map((c) => c.displayName).join(", ")}>⚠</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-teal-100 px-4 py-2">
                <button type="button" onClick={() => setSwapSlot(null)} className="text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recipe picker */}
      {openSlot && (() => {
        const weekdayIndex = (openSlot.date.getDay() + 6) % 7;
        const slotTheme = themeDays[weekdayIndex]?.[openSlot.meal as MealType] ?? "";
        const themeWords = slotTheme.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        const filtered = filterRecipes(recipes, pickerSearch, pickerTag);
        const matchesTheme = (r: Recipe) => themeWords.length > 0 && themeWords.some((w) => r.title.toLowerCase().includes(w) || (r.tags ?? []).some((t) => t.toLowerCase().includes(w)));
        const suggestedRecipes = slotTheme ? filtered.filter(matchesTheme) : [];
        const otherRecipes = slotTheme ? filtered.filter((r) => !matchesTheme(r)) : filtered;
        const pickerTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setOpenSlot(null); setPickerSearch(""); setPickerTag(null); }} role="presentation">
            <div className="mx-4 max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Elegir receta">
              <div className="border-b border-teal-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-teal-900">Elegir receta para {openSlot.meal}</h3>
                <p className="text-xs text-zinc-500">{openSlot.date.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</p>
                {slotTheme && <p className="mt-1 text-xs font-medium text-amber-600">Tema del día: {slotTheme}</p>}
              </div>
              <div className="border-b border-teal-100 px-4 py-2">
                <input type="search" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Buscar..." className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                {pickerTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" onClick={() => setPickerTag(null)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${!pickerTag ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700"}`}>Todas</button>
                    {pickerTags.map((t) => (
                      <button key={t} type="button" onClick={() => setPickerTag(pickerTag === t ? null : t)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pickerTag === t ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700"}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="max-h-[40vh] overflow-y-auto">
                {filtered.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-zinc-500">Ninguna receta coincide con el filtro.</li>
                ) : (
                  <>
                    {slotTheme && suggestedRecipes.length > 0 && (
                      <>
                        <li className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Sugeridas para «{slotTheme}»</li>
                        {suggestedRecipes.map((r) => (
                          <li key={r.id}><button type="button" onClick={() => assignRecipe(r.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-teal-50"><span>{r.title}</span><span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">✓ tema</span></button></li>
                        ))}
                      </>
                    )}
                    {otherRecipes.length > 0 && (
                      <>
                        {slotTheme && <li className="sticky top-0 z-10 border-b border-teal-100 bg-teal-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-teal-800">Otras recetas</li>}
                        {otherRecipes.map((r) => (
                          <li key={r.id}><button type="button" onClick={() => assignRecipe(r.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-zinc-600 transition hover:bg-teal-50"><span>{r.title}</span></button></li>
                        ))}
                      </>
                    )}
                  </>
                )}
              </ul>
              <div className="border-t border-teal-100 px-4 py-2">
                <button type="button" onClick={() => { setOpenSlot(null); setPickerSearch(""); setPickerTag(null); }} className="text-sm text-zinc-500 hover:text-zinc-700">Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
