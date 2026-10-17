"use client";

import type { AdminCategoryBreakdown } from "@/lib/types";

export function CategoryBreakdownChart({ items }: { items: AdminCategoryBreakdown[] }) {
  const topItems = items.slice(0, 6);
  const maxScore = Math.max(1, ...topItems.map((item) => item.totalScore));

  return (
    <div className="rounded-[32px] border border-black/8 bg-white/86 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-black/42">Category Performance</div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-black">Score distribution</h2>
        </div>
        <p className="max-w-xl text-sm font-bold leading-6 text-black/48">
          Categories are ranked by score contribution, with active content and player reach shown inline instead of nested panels.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border border-black/6 bg-[linear-gradient(180deg,rgba(15,23,42,0.01),rgba(15,23,42,0.04))]">
        <div className="hidden grid-cols-[72px_minmax(0,1.4fr)_140px_160px_120px] gap-4 border-b border-black/8 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-black/40 md:grid">
          <span>Rank</span>
          <span>Category</span>
          <span>Players</span>
          <span>Active Content</span>
          <span className="text-right">Score</span>
        </div>

        <div className="divide-y divide-black/6">
          {topItems.map((item, index) => (
            <div key={item.categoryId} className="px-5 py-5">
              <div className="grid gap-4 md:grid-cols-[72px_minmax(0,1.4fr)_140px_160px_120px] md:items-center">
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-black/38">
                  #{index + 1}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-black">{item.title}</div>
                  <div className="mt-1 text-xs font-bold text-black/44">
                    {item.activeLevels} active levels
                  </div>
                </div>

                <div className="text-sm font-bold text-black/62">{item.players} players</div>
                <div className="text-sm font-bold text-black/62">
                  {item.activeLevels} levels, {item.activeQuestions} questions
                </div>
                <div className="text-left text-2xl font-black tracking-[-0.04em] text-black md:text-right">
                  {item.totalScore}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#111827,#475569)]"
                  style={{ width: `${(item.totalScore / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
