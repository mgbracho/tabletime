import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Configuración incorrecta" }, { status: 500 });
  }
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: myMembershipRows } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);

  const myMembership = myMembershipRows?.[0];
  if (!myMembership?.household_id) {
    return NextResponse.json({ members: [] });
  }

  const { data: members } = await db
    .from("household_members")
    .select("id, user_id, display_name, default_servings, dietary_restrictions")
    .eq("household_id", myMembership.household_id);

  const userIdsWithoutName = (members ?? [])
    .filter((m) => m.user_id && !(m.display_name?.trim()))
    .map((m) => m.user_id as string);
  const emailByUserId: Record<string, string> = {};
  await Promise.all(
    userIdsWithoutName.map(async (uid) => {
      const { data } = await db.auth.admin.getUserById(uid);
      if (data?.user?.email) emailByUserId[uid] = data.user.email;
    })
  );

  const list = (members ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id ?? "",
    display_name: m.display_name ?? null,
    email: m.user_id ? emailByUserId[m.user_id] ?? null : null,
    default_servings: typeof m.default_servings === "number" ? m.default_servings : 1,
    dietary_restrictions: Array.isArray(m.dietary_restrictions) ? m.dietary_restrictions : [],
    is_current_user: m.user_id === user.id,
  }));

  return NextResponse.json({ members: list });
}

/** POST: añadir un miembro sin cuenta (solo perfil: ej. hijo que no usa la app) */
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

  let body: { display_name?: string; default_servings?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Configuración incorrecta" }, { status: 500 });
  }
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: myMembershipRows } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);

  const myMembership = myMembershipRows?.[0];
  if (!myMembership?.household_id) {
    return NextResponse.json({ error: "No perteneces a un hogar" }, { status: 403 });
  }

  const display_name = typeof body.display_name === "string" ? body.display_name.trim() || null : null;
  const default_servings = typeof body.default_servings === "number"
    ? Math.max(1, Math.min(20, Math.round(body.default_servings)))
    : 1;

  const { data: inserted, error } = await db
    .from("household_members")
    .insert({
      household_id: myMembership.household_id,
      user_id: null,
      role: "member",
      display_name: display_name ?? "Nuevo miembro",
      default_servings,
      dietary_restrictions: [],
    })
    .select("id, user_id, display_name, default_servings, dietary_restrictions")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    member: {
      id: inserted.id,
      user_id: inserted.user_id ?? "",
      display_name: inserted.display_name ?? null,
      default_servings: inserted.default_servings ?? 1,
      dietary_restrictions: inserted.dietary_restrictions ?? [],
      is_current_user: false,
    },
  });
}
