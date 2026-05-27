import { NextRequest, NextResponse } from "next/server";

const PROMPT = `Analysiere dieses Essensfoto und antworte NUR mit einem JSON-Objekt, ohne Markdown oder Erklärungen:
{"name":"Lebensmittelname auf Deutsch","quantity_g":100,"kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}
Schätze die sichtbare Portionsgröße in quantity_g. Alle Nährwerte beziehen sich auf die abgebildete Menge.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, apiUrl, apiKey, modelName } = (await req.json()) as {
      imageBase64: string;
      apiUrl: string;
      apiKey?: string;
      modelName?: string;
    };

    if (!apiUrl) return NextResponse.json({ error: "API-URL fehlt" }, { status: 400 });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const body: Record<string, unknown> = {
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
      max_tokens: 300,
    };
    if (modelName) body.model = modelName;

    const upstream = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });

    if (!upstream.ok) {
      const err = await upstream.text();
      return NextResponse.json({ error: `API-Fehler ${upstream.status}: ${err}` }, { status: upstream.status });
    }

    const data = await upstream.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "Keine verwertbare Antwort erhalten" }, { status: 500 });

    return NextResponse.json(JSON.parse(match[0]));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
