"use client";

import { useState, useMemo } from "react";
import type { Recipe, PlanState } from "@/lib/sync/use-tabletime-data";
import { useLanguage } from "@/lib/i18n";
import { loadVisibleMeals } from "@/lib/constants";
import { getWeekStart, getWeekDates } from "@/lib/utils/calendar";
import {
  type GroceryItem,
  getGroceryItemsFromPlan,
  mergeGroceryItems,
  normalizeIngredientForGrouping,
  getGroceryCategory,
} from "@/lib/utils/grocery";

const CATEGORY_ORDER = ["vegetables", "dairy", "meat", "pantry", "other"] as const;
const CATEGORY_STYLES: Record<string, string> = {
  vegetables: "border-l-teal-600 bg-teal-50/50",
  dairy: "border-l-teal-400 bg-teal-300/10",
  meat: "border-l-amber-600 bg-amber-50/50",
  pantry: "border-l-teal-700 bg-teal-100/50",
  other: "border-l-amber-500 bg-amber-50/40",
};

export function GroceryListView({
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
  const { t, locale } = useLanguage();
  const [newItem, setNewItem] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Use the week currently shown in the calendar (saved to localStorage on navigation)
  const weekStart = useMemo(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("tabletime-cal-week") : null;
      if (s) { const d = new Date(s); if (!isNaN(d.getTime())) return d; }
    } catch {}
    return getWeekStart();
  }, []);
  const visibleMeals = loadVisibleMeals();
  const fromPlan = getGroceryItemsFromPlan(plan, recipes, weekStart, visibleMeals);
  const manualAsItems: GroceryItem[] = manualItems.map((m) => ({ ...m, fromPlan: false }));
  const allItems: GroceryItem[] = mergeGroceryItems([...fromPlan, ...manualAsItems]);

  const grouped = CATEGORY_ORDER.map((key) => ({
    key,
    label: t(`cat.${key}`),
    items: allItems.filter((item) => getGroceryCategory(item.label) === key),
  })).filter((g) => g.items.length > 0);

  const weekDays = getWeekDates(weekStart);
  const weekTitle =
    weekDays[0].date.getDate() +
    " – " +
    weekDays[6].date.getDate() +
    " " +
    weekDays[0].date.toLocaleDateString(locale, { month: "long" });

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
      setManualItems((prev) => prev.filter((i) => normalizeIngredientForGrouping(i.label) !== key));
    } else {
      setManualItems((prev) => prev.filter((i) => i.id !== id));
    }
    setCheckedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const getExportText = () => {
    return [
      t("gro.listTitle"),
      t("gro.weekOf", { week: weekTitle }),
      "",
      ...allItems.map((item) => `${checkedIds.has(item.id) ? "☑" : "☐"} ${item.label}`),
      "",
      "---",
      "TableTime",
    ].join("\n");
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

  const shareList = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: t("gro.listTitle"), text: getExportText() });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await copyToClipboard();
      }
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
    const listTitle = t("gro.listTitle");
    const weekLabel = t("gro.weekOf", { week: weekTitle });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(listTitle)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;max-width:400px;margin:0 auto;font-size:14px}h1{font-size:1.25rem;margin:0 0 8px}p{color:#555;margin:0 0 16px}ul{list-style:none;padding:0;margin:0}</style></head><body><h1>${escape(listTitle)}</h1><p>${escape(weekLabel)}</p><ul>${itemsHtml}</ul></body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 500); }, 100);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-amber-50/70 px-4 py-3">
        <p className="text-sm font-medium text-teal-800">{t("gro.desc")}</p>
        {allItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyToClipboard} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">
              {copyFeedback ? t("gro.copied") : t("gro.copy")}
            </button>
            <button type="button" onClick={downloadTxt} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">{t("gro.download")}</button>
            {"share" in (typeof navigator !== "undefined" ? navigator : {}) && (
              <button type="button" onClick={shareList} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">{t("gro.share")}</button>
            )}
            <button type="button" onClick={handlePrint} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50">{t("gro.print")}</button>
          </div>
        )}
      </div>

      <form onSubmit={addManual} className="flex gap-2">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("gro.addProduct")} className="flex-1 rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
        <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">{t("gro.add")}</button>
      </form>

      {allItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-teal-200 bg-teal-50/30 py-8 text-center text-sm text-zinc-600">
          {t("gro.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.key} className={`rounded-xl border-l-4 ${CATEGORY_STYLES[group.key]} border border-teal-200 p-3`}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800">{group.label}</h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const checked = checkedIds.has(item.id);
                  return (
                    <li key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${checked ? "border-teal-100 bg-teal-50/50 text-zinc-500 line-through" : "border-teal-100 bg-white"}`}>
                      <button type="button" onClick={() => toggle(item.id)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-teal-300 text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400" aria-label={checked ? t("gro.markNotBought") : t("gro.markBought")}>
                        {checked ? "✓" : ""}
                      </button>
                      <span className="min-w-0 flex-1 text-sm">{item.label}</span>
                      {!item.fromPlan && (
                        <button type="button" onClick={() => removeManual(item.id)} className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600" aria-label={t("gro.remove")}>✕</button>
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
