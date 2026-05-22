"use client";

import { useLanguage } from "@/lib/i18n";
import type { Language } from "@/lib/i18n/translations";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 rounded-full bg-teal-50 p-0.5 ring-1 ring-teal-100">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
            lang === code
              ? "bg-white text-teal-900 shadow-sm"
              : "text-teal-600 hover:bg-teal-100"
          }`}
          aria-pressed={lang === code}
          aria-label={label}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
