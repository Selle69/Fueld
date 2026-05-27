"use client";

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}

export default function MacroBar({ label, value, target, unit, color }: MacroBarProps) {
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-semibold text-slate-700">
          {Math.round(value)}/{target} {unit}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
