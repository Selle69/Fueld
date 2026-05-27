"use client";
import { useState, useRef, useEffect } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center hover:bg-slate-300 focus:outline-none ml-1 flex-shrink-0"
        aria-label="Info"
      >
        i
      </button>
      {open && (
        <span className="absolute z-50 bottom-6 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs text-slate-600 leading-relaxed font-normal">
          {text}
        </span>
      )}
    </span>
  );
}
