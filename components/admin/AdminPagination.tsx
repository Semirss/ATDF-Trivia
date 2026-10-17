"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { clamp } from "@/lib/utils";

interface AdminPaginationProps {
  itemLabel: string;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function AdminPagination({
  itemLabel,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [6, 10, 20, 40]
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = clamp(page, 1, totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-black/10 bg-white/82 px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm font-bold text-black/58">
        Showing <span className="font-black text-black">{start}</span>
        {" - "}
        <span className="font-black text-black">{end}</span>
        {" of "}
        <span className="font-black text-black">{totalItems}</span>
        {" "}
        {itemLabel}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-black/45">
          Per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-10 rounded-full border border-black/10 bg-black/[0.03] px-3 text-sm font-black text-black"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[110px] rounded-full bg-black px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-honey">
            Page {safePage} / {totalPages}
          </div>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-black disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
