"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string | undefined;
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"loading" | "joining" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Enlace inválido");
      return;
    }
    if (loading) return;
    if (!user) {
      const next = `/invite/${token}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setStatus("joining");
    fetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("ok");
          setMessage("Te hemos añadido al hogar. Redirigiendo…");
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
          return;
        }
        setStatus("error");
        setMessage(data.error || "No se pudo unir al hogar");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión");
      });
  }, [token, user, loading, router]);

  if (status === "loading" || status === "joining") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50/60 px-4">
        <p className="text-teal-800">
          {status === "joining" ? "Uniendo al hogar…" : "Cargando…"}
        </p>
      </div>
    );
  }
  if (status === "ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-50/60 px-4">
        <p className="text-teal-800">{message}</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50/60 px-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">{message}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
