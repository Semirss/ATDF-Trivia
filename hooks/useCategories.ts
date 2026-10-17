"use client";

import { useMemo } from "react";
import { useContentStore } from "@/store/contentStore";

export function useCategories({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  const categories = useContentStore((state) => state.categories);

  return useMemo(
    () =>
      [...categories]
        .filter((category) => includeInactive || category.isActive)
        .sort((first, second) => first.sortOrder - second.sortOrder),
    [categories, includeInactive]
  );
}
