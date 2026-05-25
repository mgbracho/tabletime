"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import Link from "next/link";

export function AuthHeader() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLanguage();

  if (loading) return null;

  return (
    <div className="absolute right-4 top-4 flex items-center gap-2 text-sm">
      <LanguageSwitcher />
      {user ? (
        <>
          <span className="text-stone-600">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
          >
            {t("auth.signOut")}
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800"
        >
          {t("auth.signIn")}
        </Link>
      )}
    </div>
  );
}
