import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const cookieStore = request.cookies;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // En Route Handler no escribimos cookies; el middleware lo hace
        },
      },
    }
  );
  const { data: { user: userFromGet } } = await supabase.auth.getUser();
  let user = userFromGet;
  let tokenFromHeader: string | null = null;
  if (!user) {
    const { data: { session } } = await supabase.auth.refreshSession();
    user = session?.user ?? null;
  }
  if (!user) {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const { data: { user: userFromToken }, error: tokenError } = await supabase.auth.getUser(token);
      user = userFromToken ?? null;
      if (user) tokenFromHeader = token;
      if (!user && tokenError) {
        return NextResponse.json(
          { error: "No autenticado", reason: "invalid_token", detail: tokenError.message },
          { status: 401 }
        );
      }
    }
  }
  if (!user) {
    const authHeader = request.headers.get("Authorization");
    const hadToken = authHeader?.startsWith("Bearer ");
    return NextResponse.json(
      {
        error: "No autenticado",
        reason: hadToken ? "invalid_token" : "no_session",
        detail: hadToken ? "El token no es válido o ha expirado." : "No se envió sesión (cookies ni Authorization).",
      },
      { status: 401 }
    );
  }

  // Si la sesión vino del header, el cliente con cookies no envía JWT en los INSERT.
  // Usamos un cliente que envía el token para que RLS vea auth.uid().
  const db = tokenFromHeader
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${tokenFromHeader}` } } }
      )
    : supabase;

  const { data: members } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);

  if (members && members.length > 0) {
    return NextResponse.json({ household_id: members[0].household_id });
  }

  const { data: household, error: hError } = await db
    .from("households")
    .insert({ name: "Mi hogar" })
    .select("id")
    .single();

  if (hError || !household) {
    return NextResponse.json(
      { error: hError?.message ?? "Error al crear hogar" },
      { status: 500 }
    );
  }

  const { error: mError } = await db.from("household_members").insert({
    household_id: household.id,
    user_id: user.id,
    role: "owner",
  });

  if (mError) {
    return NextResponse.json(
      { error: mError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ household_id: household.id });
}
