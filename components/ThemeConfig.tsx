"use client";

import { ThemeDays } from "@/lib/sync/use-tabletime-data";
import { MealType } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n";

// These are the Spanish internal keys used in ThemeDays data — must NOT change
const MEAL_KEYS = ["Desayuno", "Comida", "Cena", "Snacks"] as const;

export function ThemeConfig({
  themeDays,
  setThemeDays,
  open,
  onClose,
}: {
  themeDays: ThemeDays;
  setThemeDays: React.Dispatch<React.SetStateAction<ThemeDays>>;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  if (!open) return null;

  // Translated day names for the row labels
  const dayLabels = Array.from({ length: 7 }, (_, i) => t(`day.${i}`));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-label={t("theme.title")}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">{t("theme.title")}</h2>
            <p className="mt-0.5 text-xs text-amber-700">{t("theme.desc")}</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
            onClick={onClose}
          >
            {t("theme.close")}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="pb-2 pr-2 font-medium text-amber-800">{t("theme.dayCol")}</th>
                  {MEAL_KEYS.map((meal) => (
                    <th key={meal} className="pb-2 px-2 font-medium text-amber-800">{t(`meal.${meal}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayLabels.map((dayLabel, i) => (
                  <tr key={i} className="border-b border-amber-100">
                    <td className="py-2 pr-2 font-medium text-amber-900">{dayLabel}</td>
                    {MEAL_KEYS.map((meal) => (
                      <td key={meal} className="px-2 py-2">
                        <input
                          type="text"
                          value={themeDays[i]?.[meal as MealType] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            setThemeDays((prev) => {
                              const next = { ...prev };
                              const dayThemes = { ...next[i] };
                              if (val) dayThemes[meal as MealType] = val;
                              else delete dayThemes[meal as MealType];
                              if (Object.keys(dayThemes).length > 0) next[i] = dayThemes;
                              else delete next[i];
                              return next;
                            });
                          }}
                          placeholder={t("theme.placeholder")}
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
      </div>
    </div>
  );
}
