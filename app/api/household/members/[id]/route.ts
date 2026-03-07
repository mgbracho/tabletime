import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function getDbAndHouseholdId(request: NextRequest) {
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
  if (!user) return { user: null as null, db: null, householdId: null };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { user, db: null, householdId: null };
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );
  const { data: row } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return { user, db, householdId: row?.household_id ?? null };
}

/** PATCH: actualizar un miembro del hogar (permite editar perfiles sin cuenta) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  const { user, db, householdId } = await getDbAndHouseholdId(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!db || !householdId) {
    return NextResponse.json({ error: "No perteneces a un hogar" }, { status: 403 });
  }

  let body: { display_name?: string | null; default_servings?: number; dietary_restrictions?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { data: member } = await db
    .from("household_members")
    .select("id, household_id")
    .eq("id", memberId)
    .eq("household_id", householdId)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const payload: { display_name?: string | null; default_servings?: number; dietary_restrictions?: string[] } = {};
  if (body.display_name !== undefined) payload.display_name = body.display_name === "" ? null : body.display_name;
  if (typeof body.default_servings === "number")
    payload.default_servings = Math.max(1, Math.min(20, Math.round(body.default_servings)));
  if (Array.isArray(body.dietary_restrictions)) payload.dietary_restrictions = body.dietary_restrictions;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await db
    .from("household_members")
    .update(payload)
    .eq("id", memberId)
    .eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE: eliminar un miembro sin cuenta (solo si user_id es null) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params;
  const { user, db, householdId } = await getDbAndHouseholdId(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!db || !householdId) {
    return NextResponse.json({ error: "No perteneces a un hogar" }, { status: 403 });
  }

  const { data: member } = await db
    .from("household_members")
    .select("id, user_id")
    .eq("id", memberId)
    .eq("household_id", householdId)
    .limit(1)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }
  if (member.user_id != null) {
    return NextResponse.json(
      { error: "Solo se pueden eliminar perfiles sin cuenta. Quien usa la app debe salir del hogar desde su cuenta." },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("household_members")
    .delete()
    .eq("id", memberId)
    .eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
