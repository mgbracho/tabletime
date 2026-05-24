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
  "@type"?: string | string[];
  name?: string;
  recipeIngredient?: Array<string | Record<string, unknown>>;
  recipeInstructions?: unknown; // handled by flattenInstructions
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

// ─── Instruction flattening ────────────────────────────────────────────────
// Handles: plain strings, HowToStep { text }, HowToSection { itemListElement }

type AnyStep = string | { "@type"?: string; text?: string; name?: string; itemListElement?: AnyStep[] };

function flattenInstructions(raw: unknown): string {
  const list: AnyStep[] = Array.isArray(raw) ? raw as AnyStep[] : (raw ? [raw as AnyStep] : []);
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      const t = stripHtml(item); if (t) out.push(t);
    } else if (item && typeof item === "object") {
      if (Array.isArray(item.itemListElement) && item.itemListElement.length > 0) {
        // HowToSection — recurse into its nested steps
        const nested = flattenInstructions(item.itemListElement);
        if (nested) out.push(...nested.split("\n\n").filter(Boolean));
      } else {
        const t = stripHtml(item.text ?? item.name ?? ""); if (t) out.push(t);
      }
    }
  }
  return out.join("\n\n");
}

// ─── JSON-LD extraction ────────────────────────────────────────────────────

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
        if (!isRecipe(item)) continue;
        const recipe = item;

        // Ingredients: handle both string[] and object[]
        const ingredients = Array.isArray(recipe.recipeIngredient)
          ? recipe.recipeIngredient
              .map((ing) => {
                if (typeof ing === "string") return stripHtml(ing);
                if (ing && typeof ing === "object") return stripHtml((ing.name as string) ?? "");
                return "";
              })
              .filter(Boolean)
              .join("\n")
          : "";

        // Instructions: flatten any combination of HowToStep / HowToSection / strings
        const instructions = recipe.recipeInstructions != null
          ? flattenInstructions(recipe.recipeInstructions)
          : "";

        return {
          title: recipe.name?.trim() ?? IMPORTED_TITLE[targetLang.toUpperCase()] ?? "Receta importada",
          ingredients,
          instructions: instructions || undefined,
          image_url: extractImageUrl(recipe.image),
        };
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

// ─── HTML microdata / plugin fallback ─────────────────────────────────────

/**
 * Extract inner text of elements with itemprop="<prop>".
 * Tries common inline/block element names until results are found.
 */
function extractByItemprop(html: string, prop: string): string[] {
  for (const tag of ["li", "span", "td", "p", "div"]) {
    const re = new RegExp(
      `<${tag}[^>]+itemprop=["'][^"']*\\b${prop}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "gi"
    );
    const results: string[] = [];
    for (const m of html.matchAll(re)) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 1) results.push(text);
    }
    if (results.length > 0) return results;
  }
  return [];
}

/**
 * Extract inner text of elements whose class attribute contains <className>.
 */
function extractByClass(html: string, className: string): string[] {
  const escaped = className.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  for (const tag of ["p", "span", "li", "div", "td"]) {
    const re = new RegExp(
      `<${tag}[^>]+class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "gi"
    );
    const results: string[] = [];
    for (const m of html.matchAll(re)) {
      const text = stripHtml(m[1]).trim();
      if (text.length > 1) results.push(text);
    }
    if (results.length > 0) return results;
  }
  return [];
}

const INGREDIENT_HEADINGS = [
  "ingredient", "ingrediente", "ingrédient", "zutaten",
  "you'll need", "you will need", "what you need",
];
const INSTRUCTION_HEADINGS = [
  "method", "instruction", "direction", "step", "how to", "preparation", "procedure",
  "método", "instrucción", "preparación", "pasos", "elaboración", "cómo",
  "zubereitung", "anleitung", "zubereiten",
];

/**
 * Find the character position immediately after the first heading whose text
 * matches one of the given keywords. Returns -1 if not found.
 */
function findHeadingEnd(html: string, keywords: string[]): number {
  const headingRe = /<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/gi;
  for (const m of html.matchAll(headingRe)) {
    if (m.index == null) continue;
    const text = stripHtml(m[1]).toLowerCase();
    if (keywords.some((kw) => text.includes(kw))) return m.index + m[0].length;
  }
  return -1;
}

/**
 * Collect all <li> items from every <tag> list found between [start, end) in html.
 */
function extractListItems(html: string, start: number, end: number, tag: "ul" | "ol"): string[] {
  const section = html.slice(start, end);
  const items: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const listMatch of section.matchAll(re)) {
    for (const li of listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = stripHtml(li[1]).trim();
      if (text.length > 1) items.push(text);
    }
  }
  return items;
}

/**
 * HTML-level fallback: try microdata (itemprop), common recipe-plugin CSS classes,
 * and heading-based section extraction for plain-HTML recipe blogs.
 *
 * Ingredient extraction only accepts <ul> lists to avoid mixing up with
 * the numbered <ol> method steps. Instruction extraction prefers <ol>.
 */
function extractRecipeFromHtml(
  html: string,
  targetLang: string
): { title: string; ingredients: string; instructions?: string; image_url?: string } | null {
  const first = <T>(arr: T[]): T[] => arr; // identity — just for readability

  // ── ingredients ──────────────────────────────────────────────────────────
  let ingredientLines: string[] = [];

  ingredientLines = first(extractByItemprop(html, "recipeIngredient"));
  if (!ingredientLines.length) ingredientLines = extractByClass(html, "wprm-recipe-ingredient-name");
  if (!ingredientLines.length) ingredientLines = extractByClass(html, "wprm-recipe-ingredient");
  if (!ingredientLines.length) ingredientLines = extractByClass(html, "tasty-recipes-ingredient");
  if (!ingredientLines.length) ingredientLines = extractByClass(html, "recipe-ingredient");
  if (!ingredientLines.length) ingredientLines = extractByClass(html, "ingredient");

  // Heading-based: only grab <ul> lists (not <ol>) to avoid capturing numbered method steps
  if (!ingredientLines.length) {
    const ingStart = findHeadingEnd(html, INGREDIENT_HEADINGS);
    if (ingStart > -1) {
      const instStart = findHeadingEnd(html, INSTRUCTION_HEADINGS);
      // Bound to the instruction section (or 10 000 chars if no instruction heading found)
      const ingEnd = instStart > ingStart ? instStart : ingStart + 10000;
      ingredientLines = extractListItems(html, ingStart, ingEnd, "ul");
    }
  }

  // ── instructions ─────────────────────────────────────────────────────────
  let instructionLines: string[] = [];

  instructionLines = first(extractByItemprop(html, "recipeInstructions"));
  if (!instructionLines.length) instructionLines = extractByClass(html, "wprm-recipe-instruction-text");
  if (!instructionLines.length) instructionLines = extractByClass(html, "tasty-recipes-instruction-text");
  if (!instructionLines.length) instructionLines = extractByClass(html, "recipe-instruction");
  if (!instructionLines.length) instructionLines = extractByClass(html, "instruction");

  // Heading-based: prefer <ol> (numbered steps), fall back to <ul>
  if (!instructionLines.length) {
    const instStart = findHeadingEnd(html, INSTRUCTION_HEADINGS);
    if (instStart > -1) {
      instructionLines = extractListItems(html, instStart, instStart + 10000, "ol");
      if (!instructionLines.length)
        instructionLines = extractListItems(html, instStart, instStart + 10000, "ul");
    }
  }

  if (!ingredientLines.length && !instructionLines.length) return null;

  const meta = extractRecipeFromMeta(html);
  return {
    title: meta?.title ?? IMPORTED_TITLE[targetLang.toUpperCase()] ?? "Receta importada",
    ingredients: ingredientLines.join("\n"),
    instructions: instructionLines.length > 0 ? instructionLines.join("\n\n") : undefined,
    image_url: meta?.image_url,
  };
}

// ─── Meta / OG fallback ───────────────────────────────────────────────────

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
        // Mimic a real browser so sites don't block the fetch
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `No se pudo acceder a la página (${res.status})` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // 1. Try JSON-LD (most reliable when present)
    const jsonLdRecipe = extractRecipeFromJsonLd(html, targetLang);
    if (jsonLdRecipe && (jsonLdRecipe.ingredients || jsonLdRecipe.instructions)) {
      const translated = await translateRecipeFields(jsonLdRecipe, targetLang);
      return NextResponse.json({ ...translated, source_url: url });
    }

    // 2. Try HTML microdata / plugin CSS classes
    const htmlRecipe = extractRecipeFromHtml(html, targetLang);
    if (htmlRecipe && (htmlRecipe.ingredients || htmlRecipe.instructions)) {
      const translated = await translateRecipeFields(htmlRecipe, targetLang);
      return NextResponse.json({ ...translated, source_url: url });
    }

    // 3. JSON-LD had a title+image but no ingredients — return partial result
    if (jsonLdRecipe) {
      const translated = await translateRecipeFields(jsonLdRecipe, targetLang);
      return NextResponse.json({ ...translated, source_url: url });
    }

    // 4. Last resort: og:title + og:image only
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
