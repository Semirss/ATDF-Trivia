"use client";

import type { LucideIcon } from "lucide-react";

export function StatsCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
          {detail ? <p className="mt-2 text-xs font-medium text-gray-500">{detail}</p> : null}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-50 border border-gray-100 text-gray-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
