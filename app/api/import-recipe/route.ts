import { NextRequest, NextResponse } from "next/server";

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_ENDPOINT = "https://api-free.deepl.com/v2/translate";

// Map our language codes to DeepL target_lang codes
const DEEPL_TARGET: Record<string, string> = {
  ES: "ES",
  EN: "EN-US",
  DE: "DE",
};

// Fallback title by target language
const IMPORTED_TITLE: Record<string, string> = {
  ES: "Receta importada",
  EN: "Imported recipe",
  DE: "Importiertes Rezept",
};

/** Translates an array of texts to the given target language via DeepL.
 *  Returns null on failure (graceful degradation). */
async function translateTexts(
  texts: string[],
  targetLang: string
): Promise<{ translated: string[]; sourceLang: string } | null> {
  if (!DEEPL_API_KEY || texts.length === 0) return null;
  const deeplTarget = DEEPL_TARGET[targetLang.toUpperCase()] ?? targetLang.toUpperCase();
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += 50) chunks.push(texts.slice(i, i + 50));
    const allTranslated: string[] = [];
    let sourceLang = targetLang;
    for (const chunk of chunks) {
      const res = await fetch(DEEPL_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: chunk, target_lang: deeplTarget }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json() as {
        translations: Array<{ text: string; detected_source_language: string }>;
      };
      if (allTranslated.length === 0) {
        sourceLang = data.translations[0]?.detected_source_language ?? targetLang;
      }
      allTranslated.push(...data.translations.map((t) => t.text));
    }
    return { translated: allTranslated, sourceLang };
  } catch {
    return null;
  }
}

type RecipeFields = { title: string; ingredients: string; instructions?: string; image_url?: string; lang?: string };

/** Translates recipe fields to targetLang. Skips if already in that language.
 *  Always returns `lang` when the source language can be detected via DeepL. */
export async function translateRecipeFields(
  recipe: { title: string; ingredients: string; instructions?: string; image_url?: string },
  targetLang: string,
  force = false
): Promise<RecipeFields> {
  if (!DEEPL_API_KEY) return recipe;

  const ingredientLines = recipe.ingredients.split("\n").filter(Boolean);
  const instructionSteps = (recipe.instructions ?? "").split("\n\n").filter(Boolean);
  const texts = [recipe.title, ...ingredientLines, ...instructionSteps];

  const result = await translateTexts(texts, targetLang);
  if (!result) return recipe;

  // Normalise to base language code (e.g. "EN-US" → "EN")
  const targetBase = targetLang.toUpperCase().split("-")[0];
  const detectedBase = result.sourceLang.toUpperCase().split("-")[0];

  // Already in target language — no translation needed, but we know the lang
  if (!force && detectedBase === targetBase) return { ...recipe, lang: targetBase };

  const { translated } = result;
  return {
    ...recipe,
    title: translated[0] ?? recipe.title,
    ingredients: translated.slice(1, 1 + ingredientLines.length).join("\n"),
    instructions:
      instructionSteps.length > 0
        ? translated.slice(1 + ingredientLines.length).join("\n\n")
        : recipe.instructions,
    lang: targetBase,
  };
}

type ImageObject = { url?: string };
type RecipeSchema = {
  "@type"?: string;
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<{ text?: string } | string>;
  image?: string | string[] | ImageObject | ImageObject[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImageUrl(image: RecipeSchema["image"]): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image || undefined;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first || undefined;
    if (first && typeof first === "object" && "url" in first) return first.url || undefined;
    return undefined;
  }
  if (typeof image === "object" && "url" in image) return image.url || undefined;
  return undefined;
}

function isRecipe(item: unknown): item is RecipeSchema {
  if (!item || typeof item !== "object") return false;
  const t = (item as { "@type"?: string | string[] })["@type"];
  if (t === "Recipe") return true;
  if (Array.isArray(t) && t.includes("Recipe")) return true;
  return false;
}

function collectItems(obj: unknown): unknown[] {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  if (Array.isArray(o["@graph"])) return (o["@graph"] as unknown[]).flatMap(collectItems);
  if (Array.isArray(obj)) return obj.flatMap(collectItems);
  return [obj];
}

function extractRecipeFromJsonLd(
  html: string,
  targetLang: string
): { title: string; ingredients: string; instructions?: string; image_url?: string } | null {
  const scriptMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of scriptMatches) {
    try {
      const json = JSON.parse(match[1].trim()) as unknown;
      const items = collectItems(json);
      for (const item of items) {
        if (isRecipe(item)) {
          const recipe = item;
          const ingredients = Array.isArray(recipe.recipeIngredient)
            ? recipe.recipeIngredient.map(stripHtml).join("\n")
            : "";
          let instructions = "";
          if (Array.isArray(recipe.recipeInstructions)) {
            instructions = recipe.recipeInstructions
              .map((step) =>
                stripHtml(typeof step === "string" ? step : ((step as { text?: string }).text ?? ""))
              )
              .filter(Boolean)
              .join("\n\n");
          }
          return {
            title:
              recipe.name?.trim() ??
              IMPORTED_TITLE[targetLang.toUpperCase()] ??
              "Receta importada",
            ingredients,
            instructions: instructions || undefined,
            image_url: extractImageUrl(recipe.image),
          };
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

function extractRecipeFromMeta(
  html: string
): { title: string; image_url?: string } | null {
  const titleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].replace(/\s*[-|]\s*.*$/, "").trim();
    if (title.length > 2) {
      const imageMatch = html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      );
      return { title, image_url: imageMatch?.[1] };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "URL requerida" }, { status: 400 });
    }
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL no válida" }, { status: 400 });
    }

    // targetLang sent by client (defaults to ES for backwards compat)
    const targetLang =
      typeof body?.targetLang === "string" && body.targetLang.length > 0
        ? body.targetLang.toUpperCase()
        : "ES";

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TableTime/1.0; +https://github.com/mgbracho/tabletime)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `No se pudo acceder a la página (${res.status})` },
        { status: 400 }
      );
    }

    const html = await res.text();
    const recipe = extractRecipeFromJsonLd(html, targetLang);
    if (recipe) {
      const translated = await translateRecipeFields(recipe, targetLang);
      return NextResponse.json({ ...translated, source_url: url });
    }

    const meta = extractRecipeFromMeta(html);
    if (meta) {
      const translated = await translateRecipeFields(
        { title: meta.title, ingredients: "", instructions: undefined, image_url: meta.image_url },
        targetLang
      );
      return NextResponse.json({ ...translated, source_url: url });
    }

    return NextResponse.json(
      { error: "No se encontró receta estructurada. Prueba otra web o añádela manualmente." },
      { status: 422 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      {
        error:
          message.includes("fetch") || message.includes("timeout")
            ? "No se pudo conectar. Verifica la URL."
            : message,
      },
      { status: 500 }
    );
  }
}
