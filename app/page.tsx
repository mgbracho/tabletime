"use client";

import { useState } from "react";
import { useTableTimeData } from "@/lib/sync/use-tabletime-data";
import type { Recipe, PlanState, ThemeDays } from "@/lib/sync/use-tabletime-data";
import { useAuth } from "@/lib/hooks/use-auth";
import { useHouseholdProfile } from "@/lib/hooks/use-household-profile";
import type { HouseholdMember } from "@/lib/hooks/use-household-profile";
import { useLanguage } from "@/lib/i18n";
import {
  TABS,
  type TabId,
  MEAL_LABELS,
  type MealType,
  CALENDAR_VISIBLE_MEALS_KEY,
  loadVisibleMeals,
} from "@/lib/constants";
import { getWeekStart, generateSuggestedPlanForWeek } from "@/lib/utils/calendar";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import { ThemeConfig } from "@/components/ThemeConfig";
import { RecipesView } from "@/components/RecipesView";
import { GroceryListView } from "@/components/GroceryListView";
import { HouseholdView } from "@/components/HouseholdView";

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
  householdMembers = [],
}: {
  activeTab: TabId;
  recipes: Recipe[];
  plan: PlanState;
  setPlan: React.Dispatch<React.SetStateAction<PlanState>>;
  onAddRecipe: (title: string, ingredients?: string, instructions?: string, tags?: string[], default_servings?: number, image_url?: string) => void;
  onRemoveRecipe: (id: string) => void;
  onUpdateRecipe: (id: string, updates: Partial<Recipe>) => void;
  manualGroceryItems: { id: string; label: string }[];
  setManualGroceryItems: React.Dispatch<React.SetStateAction<{ id: string; label: string }[]>>;
  groceryCheckedIds: Set<string>;
  setGroceryCheckedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  themeDays: ThemeDays;
  setThemeDays: React.Dispatch<React.SetStateAction<ThemeDays>>;
  addManualGroceryItem?: (label: string) => void;
  householdMembers?: HouseholdMember[];
}) {
  const [calendarViewingRecipe, setCalendarViewingRecipe] = useState<Recipe | null>(null);
  const [calendarViewServings, setCalendarViewServings] = useState(4);
  const [visibleMeals, setVisibleMeals] = useState<MealType[]>(() => [...loadVisibleMeals()]);
  const [themeConfigOpen, setThemeConfigOpen] = useState(false);
  const [calTranslateState, setCalTranslateState] = useState<Record<string, "loading" | "done" | "error">>({});

  const { t, lang } = useLanguage();
  const LANG_NAMES: Record<string, string> = { ES: "Español", EN: "English", DE: "Deutsch" };
  const langLabel = LANG_NAMES[lang.toUpperCase()] ?? lang.toUpperCase();

  const handleCalendarTranslate = async (recipe: Recipe) => {
    const id = recipe.id;
    setCalTranslateState((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch("/api/translate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          ingredients: recipe.ingredients ?? "",
          instructions: recipe.instructions,
          targetLang: lang.toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      onUpdateRecipe(id, {
        title: data.title ?? recipe.title,
        ingredients: data.ingredients ?? recipe.ingredients,
        instructions: data.instructions ?? recipe.instructions,
      });
      setCalendarViewingRecipe((prev) =>
        prev && prev.id === id
          ? { ...prev, title: data.title ?? prev.title, ingredients: data.ingredients ?? prev.ingredients, instructions: data.instructions ?? prev.instructions }
          : prev
      );
      setCalTranslateState((prev) => ({ ...prev, [id]: "done" }));
      setTimeout(() => setCalTranslateState((prev) => { const next = { ...prev }; delete next[id]; return next; }), 2000);
    } catch {
      setCalTranslateState((prev) => ({ ...prev, [id]: "error" }));
      setTimeout(() => setCalTranslateState((prev) => { const next = { ...prev }; delete next[id]; return next; }), 3000);
    }
  };

  const setVisibleMealsAndPersist = (
    next: MealType[] | ((prev: MealType[]) => MealType[])
  ) => {
    setVisibleMeals((prev) => {
      const nextVal = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem(CALENDAR_VISIBLE_MEALS_KEY, JSON.stringify(nextVal)); } catch (_) {}
      return nextVal;
    });
  };

  const toggleMeal = (meal: MealType) => {
    setVisibleMealsAndPersist((prev) => {
      if (prev.includes(meal) && prev.length <= 1) return prev;
      if (prev.includes(meal)) return prev.filter((m) => m !== meal);
      return [...prev, meal].sort((a, b) => MEAL_LABELS.indexOf(a) - MEAL_LABELS.indexOf(b));
    });
  };

  if (activeTab === "calendar") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-white px-3 py-2 shadow-sm">
          <div className="flex w-full gap-2 overflow-x-auto pb-1">
            {MEAL_LABELS.map((meal) => (
              <button
                key={meal}
                type="button"
                onClick={() => toggleMeal(meal)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${
                  visibleMeals.includes(meal)
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white/70 text-teal-800 border border-teal-200 hover:bg-teal-50"
                }`}
              >
                {t(`meal.${meal}`)}
              </button>
            ))}
          </div>
        </div>
        <CalendarWeekView
          recipes={recipes}
          plan={plan}
          setPlan={setPlan}
          themeDays={themeDays}
          onViewRecipe={(r) => { setCalendarViewingRecipe(r); setCalendarViewServings(r.default_servings ?? 4); }}
          onEditThemes={() => setThemeConfigOpen(true)}
          members={householdMembers}
          visibleMeals={visibleMeals}
        />
        {calendarViewingRecipe && (
          <RecipeDetailModal
            recipe={calendarViewingRecipe}
            viewServings={calendarViewServings}
            setViewServings={setCalendarViewServings}
            onClose={() => setCalendarViewingRecipe(null)}
            onUpdateRecipe={(id, patch) => {
              onUpdateRecipe(id, patch);
              setCalendarViewingRecipe((prev) => (prev && prev.id === id ? { ...prev, ...patch } : null));
            }}
            onTranslate={lang.toUpperCase() !== "ES" ? handleCalendarTranslate : undefined}
            translateState={calTranslateState}
            langLabel={langLabel}
          />
        )}
        <ThemeConfig
          themeDays={themeDays}
          setThemeDays={setThemeDays}
          open={themeConfigOpen}
          onClose={() => setThemeConfigOpen(false)}
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

  if (activeTab === "household") {
    return <HouseholdView />;
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
    recipes, setRecipes,
    plan, setPlan,
    manualGroceryItems, setManualGroceryItems,
    groceryCheckedIds, setGroceryCheckedIds,
    themeDays, setThemeDays,
    addRecipe, addManualGroceryItem, updateRecipe, removeRecipe,
    hasHydrated, syncLoading, syncError, cloudUnavailable, isRemote, ensureError,
  } = useTableTimeData();

  const { user, householdId } = useAuth();
  const { members: householdMembers } = useHouseholdProfile(householdId, user?.id ?? null);
  const { t } = useLanguage();

  const [creatingPlan, setCreatingPlan] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCreatePlan = () => {
    setActiveTab("calendar");
    setCreatingPlan(true);
    const visibleMeals = loadVisibleMeals();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPlan((prev) => ({
          ...prev,
          ...generateSuggestedPlanForWeek(recipes, themeDays, prev, getWeekStart(), visibleMeals),
        }));
        setCreatingPlan(false);
        setToastMessage(t("plan.created"));
        setTimeout(() => setToastMessage(null), 3000);
      });
    });
  };

  if (!hasHydrated || syncLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 via-white to-teal-50/60">
        <p className="text-zinc-500">{t("app.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-teal-50/60 px-4 py-10 font-sans text-zinc-900">
      {syncError && (
        <div className="mx-auto max-w-5xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 ring-1 ring-red-200">
          {t("app.syncError", { error: syncError })}
        </div>
      )}
      {cloudUnavailable && (
        <div className="mx-auto max-w-5xl rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          {t("app.cloudUnavailable")}
          {ensureError && <span className="mt-1 block font-medium">{t("app.cloudUnavailableReason", { reason: ensureError })}</span>}
        </div>
      )}
      {isRemote && !syncError && (
        <div className="mx-auto max-w-5xl text-right text-xs text-teal-700">{t("app.syncedCloud")}</div>
      )}
      <main className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-teal-900 sm:text-4xl">TableTime</h1>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreatePlan}
              disabled={creatingPlan}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-70"
            >
              {creatingPlan ? t("plan.creating") : t("plan.create")}
            </button>
          </div>
        </header>

        <nav className="flex gap-2 rounded-full bg-teal-300/20 p-1 text-sm font-medium text-teal-800 sm:max-w-md">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                tab.id === activeTab ? "bg-white text-teal-700 shadow-sm" : "bg-transparent hover:bg-teal-100"
              }`}
              type="button"
            >
              {t(`tab.${tab.id}`)}
            </button>
          ))}
        </nav>

        <section className="rounded-2xl bg-white/80 p-6 shadow-sm ring-1 ring-teal-50">
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
            householdMembers={householdMembers}
          />
        </section>
      </main>

      {toastMessage && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-teal-800 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
