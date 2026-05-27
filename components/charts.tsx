"use client";

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 320, H = 150;
const PAD = { t: 10, r: 12, b: 30, l: 44 };
const CW = W - PAD.l - PAD.r; // 264
const CH = H - PAD.t - PAD.b; // 110

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(s: string): string {
  try {
    const d = new Date(s + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return s.slice(5);
  }
}

function fmtNum(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}k`;
  if (n >= 100) return String(Math.round(n));
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function pickIdx(len: number, max = 5): number[] {
  if (len <= max) return Array.from({ length: len }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < max; i++) out.add(Math.round((i * (len - 1)) / (max - 1)));
  return [...out].sort((a, b) => a - b);
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-16 text-xs text-slate-400">
      Keine Daten im Zeitraum
    </div>
  );
}

// ─── SparkLine ────────────────────────────────────────────────────────────────
export function SparkLine({ data, color = "#3B82F6" }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="h-8" />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 0.001);
  const sw = 100, sh = 36, pad = 4;
  const cw = sw - pad * 2, ch = sh - pad * 2;
  const sx = (i: number) => pad + (i / (data.length - 1)) * cw;
  const sy = (v: number) => pad + ch - ((v - min) / range) * ch;
  const pts = data.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${sw} ${sh}`} className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(data.length - 1)} cy={sy(data[data.length - 1])} r="3" fill={color} />
    </svg>
  );
}

// ─── LineChart ────────────────────────────────────────────────────────────────
export interface LinePoint { x: string; y: number }

export function LineChart({
  data, color = "#3B82F6", unit = "", targetY,
}: {
  data: LinePoint[]; color?: string; unit?: string; targetY?: number;
}) {
  if (data.length === 0) return <EmptyState />;

  const ys = data.map(d => d.y);
  const rawMax = Math.max(...ys, targetY ?? 0);
  const rawMin = Math.min(...ys);
  const pad = (rawMax - rawMin) * 0.1 || rawMax * 0.1 || 1;
  const minY = Math.max(0, rawMin - pad);
  const maxY = rawMax + pad;
  const range = Math.max(maxY - minY, 0.001);

  const sx = (i: number) => PAD.l + (data.length > 1 ? i / (data.length - 1) : 0.5) * CW;
  const sy = (v: number) => PAD.t + CH - ((v - minY) / range) * CH;
  const pts = data.map((d, i) => `${sx(i)},${sy(d.y)}`).join(" ");
  const labelIdx = pickIdx(data.length);
  const yTicks = [minY, (minY + maxY) / 2, maxY];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yTicks.map((v, i) => (
        <line key={i} x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)}
          stroke="#F1F5F9" strokeWidth="1" />
      ))}
      {targetY != null && (
        <line x1={PAD.l} y1={sy(targetY)} x2={W - PAD.r} y2={sy(targetY)}
          stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4,3" />
      )}
      {data.length > 1 && (
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {data.map((d, i) => (
        <circle key={i} cx={sx(i)} cy={sy(d.y)} r="3" fill="white" stroke={color} strokeWidth="2" />
      ))}
      {labelIdx.map(i => (
        <text key={i} x={sx(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#94A3B8">
          {fmtDate(data[i].x)}
        </text>
      ))}
      {yTicks.map((v, i) => (
        <text key={i} x={PAD.l - 4} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
          {fmtNum(v)}{unit}
        </text>
      ))}
    </svg>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────
export interface BarPoint { x: string; y: number }

export function BarChart({
  data, color = "#3B82F6", unit = "", targetY,
}: {
  data: BarPoint[]; color?: string; unit?: string; targetY?: number;
}) {
  if (data.length === 0) return <EmptyState />;

  const maxY = Math.max(...data.map(d => d.y), targetY ?? 0, 1);
  const sy = (v: number) => PAD.t + CH - (v / maxY) * CH;
  const bw = Math.max(4, (CW / data.length) * 0.65);
  const bx = (i: number) => PAD.l + ((i + 0.5) / data.length) * CW - bw / 2;
  const labelIdx = pickIdx(data.length);
  const yTicks = [0, maxY / 2, maxY];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yTicks.map((v, i) => (
        <line key={i} x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)}
          stroke="#F1F5F9" strokeWidth="1" />
      ))}
      {targetY != null && (
        <line x1={PAD.l} y1={sy(targetY)} x2={W - PAD.r} y2={sy(targetY)}
          stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4,3" />
      )}
      {data.map((d, i) => {
        const y = sy(d.y);
        const h = PAD.t + CH - y;
        return (
          <rect key={i} x={bx(i)} y={y} width={bw} height={Math.max(h, d.y > 0 ? 2 : 0)}
            fill={color} rx="2" opacity={d.y === 0 ? 0.15 : 0.85} />
        );
      })}
      {labelIdx.map(i => (
        <text key={i} x={bx(i) + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#94A3B8">
          {fmtDate(data[i].x)}
        </text>
      ))}
      {yTicks.map((v, i) => (
        <text key={i} x={PAD.l - 4} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
          {fmtNum(v)}{unit}
        </text>
      ))}
    </svg>
  );
}

// ─── MacroStackedChart ────────────────────────────────────────────────────────
export interface MacroDay {
  x: string;
  protein_kcal: number;
  carbs_kcal: number;
  fat_kcal: number;
  target_kcal?: number;
}

const MACRO_SEGS = [
  { key: "protein_kcal" as const, color: "#3B82F6" },
  { key: "carbs_kcal" as const, color: "#22C55E" },
  { key: "fat_kcal" as const, color: "#F97316" },
];

export function MacroStackedChart({ data }: { data: MacroDay[] }) {
  if (data.length === 0) return <EmptyState />;

  const targets = data.flatMap(d => (d.target_kcal ? [d.target_kcal] : []));
  const maxY = Math.max(
    ...data.map(d => d.protein_kcal + d.carbs_kcal + d.fat_kcal),
    ...(targets.length ? targets : [0]),
    1,
  );
  const avgTarget = targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : null;

  const sy = (v: number) => PAD.t + CH - (v / maxY) * CH;
  const bw = Math.max(4, (CW / data.length) * 0.65);
  const bx = (i: number) => PAD.l + ((i + 0.5) / data.length) * CW - bw / 2;
  const labelIdx = pickIdx(data.length);
  const yTicks = [0, maxY / 2, maxY];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yTicks.map((v, i) => (
        <line key={i} x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)}
          stroke="#F1F5F9" strokeWidth="1" />
      ))}
      {avgTarget != null && (
        <line x1={PAD.l} y1={sy(avgTarget)} x2={W - PAD.r} y2={sy(avgTarget)}
          stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4,3" />
      )}
      {data.map((d, i) => {
        const total = d.protein_kcal + d.carbs_kcal + d.fat_kcal;
        if (total === 0) {
          return <rect key={i} x={bx(i)} y={PAD.t + CH - 2} width={bw} height={2} fill="#E2E8F0" rx="1" />;
        }
        let cum = 0;
        return MACRO_SEGS.map(seg => {
          const v = d[seg.key];
          const top = sy(cum + v), bot = sy(cum);
          const h = bot - top;
          cum += v;
          if (h <= 0) return null;
          return <rect key={seg.key} x={bx(i)} y={top} width={bw} height={h} fill={seg.color} />;
        });
      })}
      {labelIdx.map(i => (
        <text key={i} x={bx(i) + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#94A3B8">
          {fmtDate(data[i].x)}
        </text>
      ))}
      {yTicks.map((v, i) => (
        <text key={i} x={PAD.l - 4} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
          {fmtNum(v)}
        </text>
      ))}
    </svg>
  );
}

// ─── HBarChart ────────────────────────────────────────────────────────────────
export interface HBarItem { label: string; value: number }

export function HBarChart({
  data, color = "#3B82F6", unit = "",
}: {
  data: HBarItem[]; color?: string; unit?: string;
}) {
  if (data.length === 0) return <EmptyState />;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const ROW = 36, LW = 110, BAR = 150, VW = 60;
  const svgW = LW + BAR + VW;
  const svgH = data.length * ROW + 8;

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full">
      {data.map((d, i) => {
        const y = i * ROW + 4;
        const barLen = (d.value / maxVal) * BAR;
        return (
          <g key={i}>
            <text x={LW - 8} y={y + ROW / 2 + 4} textAnchor="end" fontSize="10" fill="#475569">
              {d.label || "Unbekannt"}
            </text>
            <rect x={LW} y={y + ROW / 2 - 7} width={BAR} height={14} fill="#F1F5F9" rx="4" />
            <rect x={LW} y={y + ROW / 2 - 7} width={Math.max(barLen, 2)} height={14}
              fill={color} rx="4" opacity={0.85} />
            <text x={LW + BAR + 6} y={y + ROW / 2 + 4} textAnchor="start" fontSize="10" fill="#64748B">
              {fmtNum(d.value)}{unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
