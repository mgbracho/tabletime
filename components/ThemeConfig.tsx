"use client";

import { ThemeDays } from "@/lib/sync/use-tabletime-data";
import { DAY_NAMES, MealType } from "@/lib/constants";

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
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-label="Editar temas de la semana"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Temas de la semana</h2>
            <p className="mt-0.5 text-xs text-amber-700">
              Asigna un tema por día y comida. Las recetas que coincidan aparecerán primero al elegir.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-amber-200">
                  <th className="pb-2 pr-2 font-medium text-amber-800">Día</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Desayuno</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Comida</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Cena</th>
                  <th className="pb-2 px-2 font-medium text-amber-800">Snacks</th>
                </tr>
              </thead>
              <tbody>
                {DAY_NAMES.map((day, i) => (
                  <tr key={i} className="border-b border-amber-100">
                    <td className="py-2 pr-2 font-medium text-amber-900">{day}</td>
                    {(["Desayuno", "Comida", "Cena", "Snacks"] as const).map((meal) => (
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
      </div>
    </div>
  );
}
