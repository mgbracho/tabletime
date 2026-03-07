"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import Link from "next/link";

export function AuthHeader() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null;

  return (
    <div className="absolute right-4 top-4 flex items-center gap-2 text-sm">
      {user ? (
        <>
          <span className="text-zinc-600">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-50"
          >
            Salir
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-white hover:bg-teal-700"
        >
          Entrar
        </Link>
      )}
    </div>
  );
}
