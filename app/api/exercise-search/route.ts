import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const key = process.env.RAPIDAPI_KEY;
  if (!key) return NextResponse.json({ error: "RAPIDAPI_KEY not set" }, { status: 500 });

  const url = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(q)}?limit=8`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return NextResponse.json([], { status: res.status });

  const data = await res.json() as Array<{ name: string; target: string; bodyPart: string; equipment: string }>;
  return NextResponse.json(
    data.map(e => ({ name: e.name, target: e.target, bodyPart: e.bodyPart, equipment: e.equipment }))
  );
}
