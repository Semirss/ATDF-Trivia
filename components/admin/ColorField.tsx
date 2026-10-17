"use client";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#56bdd7";

  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/[0.03] p-3">
        <input
          type="color"
          value={safeValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-16 cursor-pointer rounded-xl border border-black/10 bg-transparent p-0"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-black/45">Hex</div>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 font-mono text-sm font-bold uppercase"
          />
        </div>
        <div className="hidden h-12 w-12 rounded-2xl border border-black/10 shadow-sm md:block" style={{ backgroundColor: safeValue }} />
      </div>
    </label>
  );
}
