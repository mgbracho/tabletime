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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role no configurada" }, { status: 500 });
  }
  const db = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: members } = await db
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);
  if (!members?.length) {
    return NextResponse.json({ error: "No perteneces a ningún hogar" }, { status: 403 });
  }
  const householdId = members[0].household_id;

  const { data: share, error } = await db
    .from("household_share_tokens")
    .insert({
      household_id: householdId,
      share_plan: true,
      share_list: true,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("token")
    .single();

  if (error || !share) {
    return NextResponse.json({ error: error?.message ?? "Error al crear enlace" }, { status: 500 });
  }

  const baseUrl = request.nextUrl.origin;
  const link = `${baseUrl}/share/${share.token}`;
  return NextResponse.json({ link, token: share.token });
}
