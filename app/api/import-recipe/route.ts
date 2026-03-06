import { NextRequest, NextResponse } from "next/server";

type RecipeSchema = {
  "@type"?: string;
  name?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<{ text?: string } | string>;
};

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
  if (Array.isArray(o["@graph"])) {
    return (o["@graph"] as unknown[]).flatMap(collectItems);
  }
  if (Array.isArray(obj)) return obj.flatMap(collectItems);
  return [obj];
}

function extractRecipeFromJsonLd(html: string): {
  title: string;
  ingredients: string;
  instructions?: string;
} | null {
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
            ? recipe.recipeIngredient.join("\n")
            : "";
          let instructions = "";
          if (Array.isArray(recipe.recipeInstructions)) {
            instructions = recipe.recipeInstructions
              .map((step) =>
                typeof step === "string" ? step : (step as { text?: string }).text
              )
              .filter(Boolean)
              .join("\n\n");
          }
          return {
            title: recipe.name?.trim() ?? "Receta importada",
            ingredients,
            instructions: instructions || undefined,
          };
        }
      }
    } catch {
      // skip invalid JSON
    }
  }
  return null;
}

function extractRecipeFromMeta(html: string): { title: string } | null {
  const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1]
      .replace(/\s*[-|]\s*.*$/, "")
      .trim();
    if (title.length > 2) return { title };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json(
        { error: "URL requerida" },
        { status: 400 }
      );
    }
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "URL no válida" },
        { status: 400 }
      );
    }

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
    const recipe = extractRecipeFromJsonLd(html);
    if (recipe) {
      return NextResponse.json(recipe);
    }

    const meta = extractRecipeFromMeta(html);
    if (meta) {
      return NextResponse.json({
        title: meta.title,
        ingredients: "",
        instructions: undefined,
      });
    }

    return NextResponse.json(
      { error: "No se encontró receta estructurada. Prueba otra web o añádela manualmente." },
      { status: 422 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: message.includes("fetch") || message.includes("timeout") ? "No se pudo conectar. Verifica la URL." : message },
      { status: 500 }
    );
  }
}
