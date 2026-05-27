"use client";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
