import { NextRequest, NextResponse } from "next/server";

export interface OFFProduct {
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query?.trim() || query.trim().length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const url =
      `https://search.openfoodfacts.org/search` +
      `?q=${encodeURIComponent(query.trim())}` +
      `&page_size=10` +
      `&fields=product_name,product_name_de,brands,nutriments`;

    const res = await fetch(url, {
      headers: { "User-Agent": "fueld-app/1.0 (nutrition tracker)" },
    });

    if (!res.ok) return NextResponse.json({ products: [] });

    const data = await res.json();

    const products: OFFProduct[] = (data.hits ?? [])
      .filter(
        (p: Record<string, unknown>) =>
          (p.product_name || p.product_name_de) &&
          (p.nutriments as Record<string, number>)?.["energy-kcal_100g"] != null
      )
      .map((p: Record<string, unknown>) => {
        const n = p.nutriments as Record<string, number>;
        return {
          name: (p.product_name_de as string) || (p.product_name as string),
          brand: (p.brands as string) || null,
          kcal_100g: Math.round(n["energy-kcal_100g"] ?? 0),
          protein_100g: Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
          carbs_100g: Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
          fat_100g: Math.round((n["fat_100g"] ?? 0) * 10) / 10,
        };
      });

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
