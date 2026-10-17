"use client";

import { QuestionExtractor } from "@/components/admin/QuestionExtractor";
import { useContentSync } from "@/hooks/useContentSync";

export default function AdminImportPage() {
  useContentSync();

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-black uppercase text-black/45">Import</p>
        <h1 className="font-display text-4xl font-black">Question Import Center</h1>
        <p className="mt-2 max-w-3xl text-sm font-bold text-black/55">
          Upload one category file and assign questions into easy, medium, and hard levels from the review queue.
        </p>
      </div>
      <QuestionExtractor />
    </div>
  );
}
