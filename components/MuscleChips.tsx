"use client";

const COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
];

function colorFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return COLORS[h % COLORS.length];
}

export function parseMuscles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))];
}

export default function MuscleChips({ muscles }: { muscles: string[] }) {
  if (muscles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {muscles.map(m => (
        <span key={m} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${colorFor(m)}`}>
          {m}
        </span>
      ))}
    </div>
  );
}
