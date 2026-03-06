import { createServerClient } from "@supabase/ssr";
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: members } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .limit(1);

  if (members && members.length > 0) {
    return NextResponse.json({ household_id: members[0].household_id });
  }

  const { data: household, error: hError } = await supabase
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

  const { error: mError } = await supabase.from("household_members").insert({
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
