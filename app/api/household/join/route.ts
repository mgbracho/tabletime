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
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const token = body.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Falta token" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role no configurada" }, { status: 500 });
  }
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: invite, error: inviteError } = await db
    .from("household_invites")
    .select("household_id, expires_at")
    .eq("token", token)
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Enlace inválido o expirado" }, { status: 404 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    await db.from("household_invites").delete().eq("token", token);
    return NextResponse.json({ error: "Este enlace ha expirado" }, { status: 410 });
  }

  const { data: existing } = await db
    .from("household_members")
    .select("id")
    .eq("household_id", invite.household_id)
    .eq("user_id", user.id)
    .limit(1);
  if (existing?.length) {
    await db.from("household_invites").delete().eq("token", token);
    return NextResponse.json({ joined: true, household_id: invite.household_id });
  }

  const { error: insertError } = await db.from("household_members").insert({
    household_id: invite.household_id,
    user_id: user.id,
    role: "member",
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await db.from("household_invites").delete().eq("token", token);
  return NextResponse.json({ joined: true, household_id: invite.household_id });
}
