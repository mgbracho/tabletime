"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { translations, type Language } from "./translations";

const STORAGE_KEY = "tabletime-lang";

const LOCALE_MAP: Record<Language, string> = {
  es: "es",
  en: "en",
  de: "de",
};

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Translate a key, optionally interpolating {variable} placeholders */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** BCP-47 locale string for use with toLocaleDateString / Intl */
  locale: string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("es");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored && (["es", "en", "de"] as Language[]).includes(stored)) {
        setLangState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let str =
        translations[lang][key] ??
        translations["es"][key] ??
        key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [lang]
  );

  const locale = LOCALE_MAP[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
