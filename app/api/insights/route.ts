import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Du bist ein erfahrener Fitness- und Gesundheitscoach.
Du analysierst Nutzerdaten aus Training, Schlaf und Ernährung und erkennst kritische Muster.
Sei direkt, konkret und motivierend. Spreche den Nutzer mit "du" an.

WICHTIG: Antworte ausschließlich mit rohem JSON-Array, ohne Markdown, ohne Code-Blöcke, ohne Erklärungen.

Jeder Eintrag hat dieses Format:
{"type":"...","icon":"emoji","title":"max 35 Zeichen","message":"1-2 konkrete Sätze","action":"Button-Text oder null"}

Erlaubte type-Werte: warning, tip, positive, training_adjustment

Für training_adjustment ZUSÄTZLICH das Feld "adjustments":
{"type":"training_adjustment","icon":"💪","title":"...","message":"...","action":"Training anpassen","adjustments":[{"exercise_id":ZAHL,"exercise_name":"Name","field":"default_sets|default_reps|default_weight_kg|default_rest_sec","current_value":ZAHL,"suggested_value":ZAHL,"reason":"Kurze Begründung"}]}

Wann training_adjustment einsetzen (nur wenn heutiges_training vorhanden):
- Schlechter Schlaf (Ø <5.5) + aktives Training heute → Volumen (Sätze) reduzieren
- Trainingsvolumen stark gestiegen (+20%) + schlechter Schlaf → Gewicht oder Sätze reduzieren
- Sehr hohes Trainingsvolumen über längere Zeit → Pause-Zeiten erhöhen

Sonstige Prioritäten:
- warning: Schlafdefizit, Gewichtsstagnation (stagnation_erkannt=true) trotz Ziel über 30+ Tage
- tip: Übungs-Stagnation, zu wenig Protein, suboptimale Kalorien
- positive: Wenn etwas nachweislich gut läuft

Gib 2–3 Einträge zurück. Wenn heutiges_training vorhanden und Anpassung sinnvoll ist, MUSS ein training_adjustment dabei sein.`;

function extractJson(text: string): unknown[] | null {
  // 1. Strip markdown code fences
  const stripped = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // 2. Try full stripped text first
  for (const candidate of [stripped, text]) {
    const arrMatch = candidate.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const parsed = JSON.parse(arrMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* try next */ }
    }
  }

  // 3. Try to find individual objects and wrap them
  const objMatches = text.matchAll(/\{[\s\S]*?\}/g);
  const objects: unknown[] = [];
  for (const m of objMatches) {
    try { objects.push(JSON.parse(m[0])); } catch { /* skip */ }
  }
  if (objects.length > 0) return objects;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { stats } = (await req.json()) as { stats: unknown };

    const apiUrl = process.env.NEXT_PUBLIC_AI_URL;
    const apiKey = process.env.NEXT_PUBLIC_AI_KEY;
    const modelName = process.env.NEXT_PUBLIC_AI_MODEL;

    if (!apiUrl) return NextResponse.json({ error: "AI nicht konfiguriert (NEXT_PUBLIC_AI_URL fehlt)" }, { status: 503 });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const body: Record<string, unknown> = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Nutzerdaten:\n${JSON.stringify(stats, null, 2)}\n\nGib jetzt dein JSON-Array aus:`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.5,
    };
    if (modelName) body.model = modelName;

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("[insights] upstream error", upstream.status, err);
      return NextResponse.json({ error: `Upstream ${upstream.status}: ${err}` }, { status: upstream.status });
    }

    const data = await upstream.json();
    const rawText: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("[insights] model raw output:", rawText.slice(0, 500));

    const insights = extractJson(rawText);
    if (!insights || insights.length === 0) {
      console.error("[insights] JSON extraction failed. Raw text:", rawText);
      return NextResponse.json(
        { error: "Modell hat kein verwertbares JSON zurückgegeben", raw: rawText.slice(0, 300) },
        { status: 500 },
      );
    }

    return NextResponse.json(insights);
  } catch (e) {
    console.error("[insights] exception:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
