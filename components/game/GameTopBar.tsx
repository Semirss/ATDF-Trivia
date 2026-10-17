"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

export function GameTopBar() {
  return (
    <div className="game-topbar pointer-events-none absolute inset-x-0 top-0 z-50">
      <Link
        href="/settings"
        aria-label="Open settings"
        className="theme-trigger pointer-events-auto grid h-11 w-11 place-items-center rounded-full"
      >
        <Settings className="h-[19px] w-[19px]" strokeWidth={2.6} />
      </Link>
    </div>
  );
}
