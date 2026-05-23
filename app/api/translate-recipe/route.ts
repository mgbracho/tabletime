import { NextRequest, NextResponse } from "next/server";
import { translateRecipeFields } from "@/app/api/import-recipe/route";

/**
 * POST /api/translate-recipe
 * Body: { title, ingredients, instructions?, targetLang }
 * Returns: { title, ingredients, instructions?, alreadyInTargetLang? }
 *
 * Translates existing recipe content to the requested language via DeepL.
 * If no DEEPL_API_KEY is set, returns the original content unchanged.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const ingredients = typeof body?.ingredients === "string" ? body.ingredients : "";
    const instructions =
      typeof body?.instructions === "string" ? body.instructions : undefined;
    const targetLang =
      typeof body?.targetLang === "string" && body.targetLang.length > 0
        ? body.targetLang.toUpperCase()
        : "ES";

    if (!title) {
      return NextResponse.json({ error: "title requerido" }, { status: 400 });
    }

    const translated = await translateRecipeFields(
      { title, ingredients, instructions },
      targetLang,
      true // force: always translate even if source == target
    );

    return NextResponse.json(translated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
