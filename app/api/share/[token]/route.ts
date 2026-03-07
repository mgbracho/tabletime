import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const MEAL_LABELS = ["Desayuno", "Comida", "Cena"] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Configuración incorrecta" }, { status: 500 });
  }
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: share, error: shareError } = await db
    .from("household_share_tokens")
    .select("household_id, share_plan, share_list, expires_at")
    .eq("token", token)
    .single();

  if (shareError || !share) {
    return NextResponse.json({ error: "Enlace inválido o expirado" }, { status: 404 });
  }
  if (new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este enlace ha expirado" }, { status: 410 });
  }

  const hid = share.household_id;

  const [hRes, recipesRes, slotsRes, themesRes, manualRes, checkedRes] = await Promise.all([
    db.from("households").select("name").eq("id", hid).single(),
    share.share_plan ? db.from("recipes").select("id, title, ingredients, instructions, tags, default_servings").eq("household_id", hid) : { data: [] },
    share.share_plan ? db.from("plan_slots").select("slot_key, recipe_id").eq("household_id", hid) : { data: [] },
    share.share_plan ? db.from("theme_days").select("day_index, meal_type, theme").eq("household_id", hid) : { data: [] },
    share.share_list ? db.from("grocery_items").select("id, label").eq("household_id", hid).eq("source", "manual") : { data: [] },
    share.share_list ? db.from("grocery_checked").select("item_key").eq("household_id", hid) : { data: [] },
  ]);

  const householdName = (hRes.data?.name as string) ?? "Mi hogar";
  const recipes = (recipesRes.data ?? []).map((r: { id: string; title: string; ingredients: string | null; instructions: string | null; tags: string[]; default_servings?: number }) => ({
    id: r.id,
    title: r.title,
    ingredients: r.ingredients ?? undefined,
    instructions: r.instructions ?? undefined,
    tags: Array.isArray(r.tags) ? r.tags : [],
    default_servings: r.default_servings,
  }));
  const plan: Record<string, string> = {};
  for (const s of slotsRes.data ?? []) {
    plan[s.slot_key] = s.recipe_id;
  }
  const themeDays: Record<number, Record<string, string>> = {};
  for (const t of themesRes.data ?? []) {
    if (!themeDays[t.day_index]) themeDays[t.day_index] = {};
    themeDays[t.day_index][t.meal_type] = t.theme;
  }
  const manualItems = (manualRes.data ?? []).map((r: { id: string; label: string }) => ({ id: r.id, label: r.label }));
  const groceryCheckedIds = (checkedRes.data ?? []).map((c: { item_key: string }) => c.item_key);

  return NextResponse.json({
    householdName,
    share_plan: share.share_plan,
    share_list: share.share_list,
    plan,
    recipes,
    themeDays,
    manualItems,
    groceryCheckedIds,
  });
}
