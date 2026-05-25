"use client";

import { useState, useEffect } from "react";
import type { Recipe, PlanState, ThemeDays } from "@/lib/sync/use-tabletime-data";
import type { HouseholdMember } from "@/lib/hooks/use-household-profile";
import { useLanguage } from "@/lib/i18n";
import {
  MEAL_LABELS,
  MealType,
  isSlotStatus,
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
  const { t, locale } = useLanguage();

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

  // Visual styling per meal type
  const MEAL_HEADER_CLASSES: Record<string, string> = {
    Desayuno: "bg-white text-amber-600",
    Comida:   "bg-white text-emerald-600",
    Cena:     "bg-white text-indigo-600",
    Snacks:   "bg-white text-purple-600",
  };
  const MEAL_PILL_CLASSES: Record<string, string> = {
    Desayuno: "bg-stone-50 ring-stone-200 text-stone-800",
    Comida:   "bg-stone-50 ring-stone-200 text-stone-800",
    Cena:     "bg-stone-50 ring-stone-200 text-stone-800",
    Snacks:   "bg-stone-50 ring-stone-200 text-stone-800",
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setViewMode("day");
  }, []);

  // Persist the selected week so the grocery list can read it
  useEffect(() => {
    try { localStorage.setItem("tabletime-cal-week", weekStart.toISOString()); } catch {}
  }, [weekStart]);

  const weekDays = getWeekDates(weekStart);
  // Apply translated day labels (Mon=0…Sun=6)
  const weekDaysT = weekDays.map((d, i) => ({ ...d, dayLabel: t(`day.${i}`) }));
  const today = new Date();

  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString(locale, { month: "long" });

  const getRecipeTitle = (recipeId: string) => recipes.find((r) => r.id === recipeId)?.title ?? recipeId;

  const getSlotStatusLabel = (s: string) => t(`status.${s}`);

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
      {/* Navigation + View mode (single row) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {viewMode === "week" && (
            <>
              <button type="button" onClick={goToPrevWeek} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.prevWeek")}</button>
              <span className="text-sm font-medium text-emerald-800">{t("cal.weekTitle", { week: weekTitle })}</span>
              <button type="button" onClick={goToNextWeek} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.nextWeek")}</button>
            </>
          )}
          {viewMode === "day" && (
            <>
              <button type="button" onClick={() => { const d = new Date(focusedDate); d.setDate(d.getDate() - 1); setFocusedDate(d); }} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.prevDay")}</button>
              <span className="text-sm font-medium text-emerald-800">{focusedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <button type="button" onClick={() => { const d = new Date(focusedDate); d.setDate(d.getDate() + 1); setFocusedDate(d); }} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.nextDay")}</button>
            </>
          )}
          {viewMode === "month" && (
            <>
              <button type="button" onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() - 1); setMonthStart(d); }} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.prevMonth")}</button>
              <span className="text-sm font-medium text-emerald-800">{monthStart.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
              <button type="button" onClick={() => { const d = new Date(monthStart); d.setMonth(d.getMonth() + 1); setMonthStart(d); }} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.nextMonth")}</button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="inline-flex rounded-full bg-stone-100 p-0.5">
            {(["week", "day", "month"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${viewMode === mode ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-stone-200"}`}>
                {mode === "week" ? t("cal.week") : mode === "day" ? t("cal.day") : t("cal.month")}
              </button>
            ))}
          </div>
          {/* More menu */}
          <div className="relative">
            <button type="button" onClick={() => setMoreMenuOpen((o) => !o)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{t("cal.more")}</button>
            {moreMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                  {onEditThemes && (
                    <>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50" onClick={() => { onEditThemes(); setMoreMenuOpen(false); }}>{t("cal.editThemes")}</button>
                      <div className="my-1 border-t border-stone-100" />
                    </>
                  )}
                  {viewMode === "week" && (
                    <>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-100" onClick={() => { copyFromPreviousWeek(); setMoreMenuOpen(false); }}>{t("cal.copyPrevWeek")}</button>
                      <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => { setClearConfirm("week"); setMoreMenuOpen(false); }}>{t("cal.clearWeek")}</button>
                      <div className="my-1 border-t border-stone-100" />
                    </>
                  )}
                  <button type="button" className="block w-full px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-50" onClick={() => {
                    printPlanToPdf(plan, recipes, themeDays, visibleMeals, {
                      locale,
                      title: t("pdf.title"),
                      formatWeekOf: (week) => t("pdf.weekOf", { week }),
                      getStatusLabel: (s) => t(`status.${s}`),
                      getMealLabel: (m) => t(`meal.${m}`),
                      getDayLabel: (i) => t(`day.${i}`),
                    });
                    setMoreMenuOpen(false);
                  }}>{t("cal.print")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day view */}
      {viewMode === "day" && (
        <div className="w-full max-w-md rounded-xl border border-emerald-200 bg-white shadow-sm ring-1 ring-emerald-100">
          <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/80 px-4 py-2">
            <span className="text-sm font-semibold text-emerald-800">{focusedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          {visibleMeals.map((meal) => {
            const key = slotKey(focusedDate, meal);
            const slotValue = plan[key];
            const recipeId = isSlotStatus(slotValue) ? null : slotValue;
            const dayIndex = (focusedDate.getDay() + 6) % 7;
            const slotTheme = themeDays[dayIndex]?.[meal as MealType];
            return (
              <div key={meal} className="flex items-center gap-3 border-b border-emerald-50 px-4 py-3 last:border-b-0">
                <span className="w-24 shrink-0 text-sm font-medium text-emerald-800">{t(`meal.${meal}`)}</span>
                <div className="min-h-[44px] flex-1 flex items-center gap-2 rounded-lg border border-emerald-50 px-3 py-2 hover:bg-emerald-50/50">
                  {recipeId ? (
                    <>
                      <button type="button" onClick={() => { const recipe = recipes.find((r) => r.id === recipeId); if (recipe && onViewRecipe) onViewRecipe(recipe); }} className="flex-1 text-left text-sm font-medium text-stone-900 hover:underline focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded">
                        {getRecipeTitle(recipeId)}
                      </button>
                      <button type="button" onClick={() => setOpenSlotMenu({ date: new Date(focusedDate), meal, key })} className="shrink-0 rounded p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label={t("cal.slotOptions")}>⋯</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setOpenSlotMenu({ date: new Date(focusedDate), meal, key })} className="flex-1 text-left">
                      <span className={`block text-sm ${isSlotStatus(slotValue) ? "font-medium text-stone-600" : slotTheme ? "text-amber-700" : "text-stone-300"}`}>
                        {isSlotStatus(slotValue) ? getSlotStatusLabel(slotValue) : slotTheme ? slotTheme : "+"}
                      </span>
                    </button>
                  )}
                </div>
                {recipeId && slotTheme && <span className="text-xs text-amber-600">{t("cal.theme")}: {slotTheme}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-emerald-200 bg-white p-2 shadow-sm ring-1 ring-emerald-100">
          <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold text-emerald-800">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="rounded bg-emerald-100/80 py-1">{t(`day.${i}`)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {getMonthGrid(monthStart).map((cell) => (
              <button key={cell.date.toISOString()} type="button" onClick={() => { setWeekStart(getWeekDates(cell.date)[0]?.date ?? cell.date); setViewMode("week"); }} className={`min-h-[52px] rounded p-1.5 text-left text-sm ${cell.isCurrentMonth ? "bg-white text-stone-800 hover:bg-emerald-50" : "bg-stone-50 text-stone-400"}`}>
                <span className="font-medium">{cell.dateLabel}</span>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {visibleMeals.map((meal) => {
                    const v = plan[slotKey(cell.date, meal)];
                    if (!v) return null;
                    return <span key={meal} className={`inline-block h-1.5 w-1.5 rounded-full ${isSlotStatus(v) ? "bg-stone-400" : "bg-emerald-600"}`} title={isSlotStatus(v) ? getSlotStatusLabel(v) : getRecipeTitle(v)} />;
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
          <div className="min-w-[600px] md:min-w-[700px] rounded-2xl border border-emerald-100 bg-white/95 shadow-sm ring-1 ring-emerald-50">
            {/* Day header row */}
            <div className="grid grid-cols-8 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-emerald-50 to-emerald-50/80">
              <div className="p-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800" />
              {weekDaysT.map((d) => {
                const isToday = d.date.toDateString() === today.toDateString();
                return (
                  <div key={d.date.toISOString()} className={`border-l border-emerald-100 px-2 py-2 text-center ${isToday ? "bg-emerald-50/60" : ""}`}>
                    <span className={`block text-[11px] font-medium ${isToday ? "text-emerald-800" : "text-stone-400"}`}>{d.dayLabel}</span>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? "bg-emerald-700 text-white" : "text-stone-600"}`}>{d.dateLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Meal rows */}
            {visibleMeals.map((meal) => (
              <div key={meal} className="grid grid-cols-8 border-b border-emerald-50 last:border-b-0">
                {/* Meal label */}
                <div className={`flex items-center justify-center border-r border-emerald-100 px-1 py-2 text-[11px] font-semibold tracking-wide ${MEAL_HEADER_CLASSES[meal] ?? "bg-emerald-50 text-emerald-800"}`}>
                  <span className="[writing-mode:vertical-lr] rotate-180 sm:[writing-mode:horizontal-tb] sm:rotate-0 text-center leading-tight">
                    {t(`meal.${meal}`)}
                  </span>
                </div>

                {/* Day cells */}
                {weekDays.map((d, dayIndex) => {
                  const key = slotKey(d.date, meal);
                  const slotValue = plan[key];
                  const recipeId = isSlotStatus(slotValue) ? null : slotValue;
                  const recipe = recipeId ? recipes.find((r) => r.id === recipeId) ?? null : null;
                  const isDragOver = dragOverKey === key;
                  const isTodayColumn = d.date.toDateString() === today.toDateString();
                  const pillClass = MEAL_PILL_CLASSES[meal] ?? "bg-emerald-50/90 ring-emerald-200/70 text-stone-900";
                  const slotTheme = themeDays[dayIndex]?.[meal];
                  const conflicts = recipe ? getRecipeConflicts(recipe, members) : [];

                  return (
                    <div
                      key={key}
                      className={`flex min-h-[72px] items-stretch border-l border-emerald-50 p-1 transition-colors ${
                        isDragOver
                          ? "bg-emerald-100 ring-inset ring-1 ring-emerald-500"
                          : isTodayColumn
                          ? "bg-emerald-50/40"
                          : "hover:bg-stone-50/60"
                      }`}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, key)}
                    >
                      {recipe ? (
                        /* ── Filled slot: recipe card ── */
                        <div
                          className={`group flex w-full flex-col overflow-hidden rounded-lg ring-1 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${pillClass}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key, recipeId!)}
                          onDragEnd={handleDragEnd}
                        >
                          {/* Optional image strip */}
                          {recipe.image_url && (
                            <img
                              src={recipe.image_url}
                              alt=""
                              loading="lazy"
                              className="h-9 w-full object-cover"
                            />
                          )}
                          <div className="flex min-w-0 items-start gap-0.5 px-1.5 py-1.5">
                            <button
                              type="button"
                              onClick={() => { if (onViewRecipe) onViewRecipe(recipe); }}
                              className="min-w-0 flex-1 text-left text-[11px] font-medium leading-snug line-clamp-2 focus:outline-none"
                            >
                              {recipe.title}
                              {conflicts.length > 0 && (
                                <span
                                  className="ml-0.5 text-amber-500 text-[10px]"
                                  title={conflicts.map((c) => t("cal.dietaryWarning", { name: c.displayName, tags: c.missingTags.join(", ") })).join("\n")}
                                  aria-label={t("cal.dietaryAlert")}
                                >⚠</span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenSlotMenu({ date: d.date, meal, key }); }}
                              className="shrink-0 rounded px-0.5 text-[12px] leading-none text-current opacity-20 hover:opacity-60 hover:bg-black/10 transition-opacity"
                              aria-label={t("cal.slotOptions")}
                            >⋯</button>
                          </div>
                          {slotTheme && (
                            <div className="px-1.5 pb-1 text-[10px] font-medium text-amber-600 truncate">
                              {slotTheme}
                            </div>
                          )}
                        </div>
                      ) : isSlotStatus(slotValue) ? (
                        /* ── Status slot (leftovers / skip) ── */
                        <button
                          type="button"
                          onClick={() => setOpenSlotMenu({ date: d.date, meal, key })}
                          className="flex w-full items-center justify-center rounded-lg bg-stone-50 ring-1 ring-stone-200 px-1.5 py-2 text-[11px] font-medium text-stone-400 hover:bg-stone-100 transition-colors"
                        >
                          {getSlotStatusLabel(slotValue)}
                        </button>
                      ) : (
                        /* ── Empty slot ── */
                        <button
                          type="button"
                          onClick={() => setOpenSlotMenu({ date: d.date, meal, key })}
                          className="group flex w-full items-center justify-center rounded-lg border border-dashed border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                        >
                          {slotTheme ? (
                            <span className="px-1 text-center text-[11px] leading-tight text-amber-500">
                              {slotTheme}
                            </span>
                          ) : (
                            <span className="text-lg font-extralight text-emerald-200 group-hover:text-emerald-500 transition-colors">+</span>
                          )}
                        </button>
                      )}
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
            <h3 id="clear-confirm-title" className="text-sm font-semibold text-stone-900">
              {clearConfirm === "week"
                ? t("cal.clearWeekConfirm")
                : clearDayIndex !== null
                  ? t("cal.clearDayConfirm", { day: weekDaysT[clearDayIndex].dayLabel, date: weekDaysT[clearDayIndex].dateLabel })
                  : t("cal.confirm")}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {clearConfirm === "week" ? t("cal.clearWeekMsg") : t("cal.clearDayMsg")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setClearConfirm(null); setClearDayIndex(null); }} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">{t("cal.cancel")}</button>
              <button type="button" onClick={runClearConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">{t("cal.delete")}</button>
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
            <div className="mx-4 w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("cal.slotActions")}>
              <p className="text-xs font-medium text-emerald-800">{date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })} · {t(`meal.${meal}`)}</p>
              {slotTheme && <p className="mt-0.5 text-[11px] text-amber-600">{t("cal.theme")}: {slotTheme}</p>}
              <div className="mt-3 space-y-2">
                <button type="button" className="w-full rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800" onClick={() => { setOpenSlot({ date, meal }); setOpenSlotMenu(null); }}>
                  {recipeId ? t("cal.changeRecipe") : t("cal.addRecipe")}
                </button>
                <div className="flex flex-wrap gap-1">
                  {(["leftovers", "skip"] as const).map((status) => (
                    <button key={status} type="button" className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100" onClick={() => { setPlan((prev) => ({ ...prev, [key]: status })); setOpenSlotMenu(null); }}>
                      {t(`status.${status}`)}
                    </button>
                  ))}
                </div>
                {(recipeId || slotValue) && (
                  <button type="button" className="w-full rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50" onClick={() => { setPlan((prev) => { const next = { ...prev }; delete next[key]; return next; }); setOpenSlotMenu(null); }}>
                    {t("cal.removeRecipe")}
                  </button>
                )}
              </div>
              <button type="button" className="mt-3 w-full text-center text-xs text-stone-500 hover:underline" onClick={() => setOpenSlotMenu(null)}>{t("cal.close")}</button>
            </div>
          </div>
        );
      })()}

      {/* Swap slot dialog */}
      {swapSlot && (() => {
        const weekdayIndex = (swapSlot.date.getDay() + 6) % 7;
        const slotTheme = themeDays[weekdayIndex]?.[swapSlot.meal as MealType] ?? "";
        const themeWords = slotTheme.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
        const matchesTheme = (r: Recipe) => themeWords.length > 0 && themeWords.some((w) => r.title.toLowerCase().includes(w) || (r.tags ?? []).some((tg) => tg.toLowerCase().includes(w)));
        const others = recipes.filter((r) => r.id !== swapSlot.currentRecipeId);
        const sortByConflicts = (a: Recipe, b: Recipe) => getRecipeConflicts(a, members).length - getRecipeConflicts(b, members).length;
        const alternatives = [
          ...others.filter(matchesTheme).sort(sortByConflicts),
          ...others.filter((r) => !matchesTheme(r)).sort(sortByConflicts),
        ].slice(0, 5);
        const key = slotKey(swapSlot.date, swapSlot.meal);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSwapSlot(null)} role="presentation">
            <div className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("cal.changeRecipe")}>
              <div className="border-b border-emerald-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-900">{t("cal.changeRecipe")}</h3>
                <p className="text-xs text-stone-500">{swapSlot.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · {t(`meal.${swapSlot.meal}`)}</p>
                {slotTheme && <p className="mt-1 text-xs font-medium text-amber-600">{t("cal.theme")}: {slotTheme}</p>}
              </div>
              <ul className="max-h-[50vh] overflow-y-auto">
                {alternatives.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-stone-500">{t("cal.noOthers")}</li>
                ) : alternatives.map((r) => {
                  const conflicts = getRecipeConflicts(r, members);
                  const matches = themeWords.length > 0 && matchesTheme(r);
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => { setPlan((prev) => ({ ...prev, [key]: r.id })); setSwapSlot(null); }} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-stone-800 transition hover:bg-emerald-50">
                        <span>{r.title}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {matches && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{t("cal.theme").toLowerCase()}</span>}
                          {conflicts.length > 0 && <span className="text-amber-500" title={conflicts.map((c) => c.displayName).join(", ")}>⚠</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-emerald-100 px-4 py-2">
                <button type="button" onClick={() => setSwapSlot(null)} className="text-sm text-stone-500 hover:text-stone-700">{t("cal.cancel")}</button>
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
        const matchesTheme = (r: Recipe) => themeWords.length > 0 && themeWords.some((w) => r.title.toLowerCase().includes(w) || (r.tags ?? []).some((tg) => tg.toLowerCase().includes(w)));
        const suggestedRecipes = slotTheme ? filtered.filter(matchesTheme) : [];
        const otherRecipes = slotTheme ? filtered.filter((r) => !matchesTheme(r)) : filtered;
        const pickerTags = Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setOpenSlot(null); setPickerSearch(""); setPickerTag(null); }} role="presentation">
            <div className="mx-4 max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("cal.chooseRecipe", { meal: t(`meal.${openSlot.meal}`) })}>
              <div className="border-b border-emerald-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-900">{t("cal.chooseRecipe", { meal: t(`meal.${openSlot.meal}`) })}</h3>
                <p className="text-xs text-stone-500">{openSlot.date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</p>
                {slotTheme && <p className="mt-1 text-xs font-medium text-amber-600">{t("cal.dayTheme", { theme: slotTheme })}</p>}
              </div>
              <div className="border-b border-emerald-100 px-4 py-2">
                <input type="search" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder={t("cal.search")} className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                {pickerTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" onClick={() => setPickerTag(null)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${!pickerTag ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"}`}>{t("cal.allTags")}</button>
                    {pickerTags.map((tg) => (
                      <button key={tg} type="button" onClick={() => setPickerTag(pickerTag === tg ? null : tg)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pickerTag === tg ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"}`}>{tg}</button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="max-h-[40vh] overflow-y-auto">
                {filtered.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-stone-500">{t("cal.noMatch")}</li>
                ) : (
                  <>
                    {slotTheme && suggestedRecipes.length > 0 && (
                      <>
                        <li className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">{t("cal.suggestedFor", { theme: slotTheme })}</li>
                        {suggestedRecipes.map((r) => (
                          <li key={r.id}><button type="button" onClick={() => assignRecipe(r.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-stone-800 transition hover:bg-emerald-50"><span>{r.title}</span><span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">✓ {t("cal.theme").toLowerCase()}</span></button></li>
                        ))}
                      </>
                    )}
                    {otherRecipes.length > 0 && (
                      <>
                        {slotTheme && <li className="sticky top-0 z-10 border-b border-emerald-100 bg-emerald-50/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">{t("cal.otherRecipes")}</li>}
                        {otherRecipes.map((r) => (
                          <li key={r.id}><button type="button" onClick={() => assignRecipe(r.id)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-stone-600 transition hover:bg-emerald-50"><span>{r.title}</span></button></li>
                        ))}
                      </>
                    )}
                  </>
                )}
              </ul>
              <div className="border-t border-emerald-100 px-4 py-2">
                <button type="button" onClick={() => { setOpenSlot(null); setPickerSearch(""); setPickerTag(null); }} className="text-sm text-stone-500 hover:text-stone-700">{t("cal.cancel")}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
