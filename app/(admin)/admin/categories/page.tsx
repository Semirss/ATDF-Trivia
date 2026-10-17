"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { deleteRemoteCategory, fetchRemoteContent, updateRemoteCategoryPartial } from "@/lib/admin-client";
import { useContentSync } from "@/hooks/useContentSync";
import { useContentStore } from "@/store/contentStore";

export default function AdminCategoriesPage() {
  useContentSync();
  const isLoaded = useContentStore((state) => state.isLoaded);
  const error = useContentStore((state) => state.error);
  const categories = useContentStore((state) => state.categories);
  const sortedCategories = [...categories].sort((first, second) => first.sortOrder - second.sortOrder);
  const replaceContent = useContentStore((state) => state.replaceContent);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const totalPages = Math.max(1, Math.ceil(sortedCategories.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleCategories = sortedCategories.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function refreshContent(successMessage?: string) {
    const content = await fetchRemoteContent();
    replaceContent(content);
    if (successMessage) {
      toast.success(successMessage);
    }
  }

  async function toggleCategory(id: string, isActive: boolean) {
    try {
      await updateRemoteCategoryPartial(id, { isActive });
      await refreshContent("Category updated");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to update category.");
    }
  }

  async function moveCategory(id: string, direction: -1 | 1) {
    const index = sortedCategories.findIndex((category) => category.id === id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= sortedCategories.length) {
      return;
    }

    const current = sortedCategories[index];
    const swap = sortedCategories[swapIndex];

    try {
      await Promise.all([
        updateRemoteCategoryPartial(current.id, { sortOrder: swap.sortOrder }),
        updateRemoteCategoryPartial(swap.id, { sortOrder: current.sortOrder })
      ]);
      await refreshContent("Category order updated");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to reorder categories.");
    }
  }

  async function deleteCategory(id: string) {
    try {
      await deleteRemoteCategory(id);
      await refreshContent("Category deleted");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to delete category.");
    }
  }

  if (!isLoaded && categories.length === 0) {
    return <div className="rounded-lg bg-white p-6 font-black">Loading categories...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-black/45">Content</p>
          <h1 className="font-display text-4xl font-black">Categories</h1>
        </div>
        <Link href="/admin/categories/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-black px-4 text-sm font-black uppercase text-white">
          <Plus className="h-4 w-4" />
          New Category
        </Link>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_auto] border-b border-black/10 bg-black/5 p-3 text-xs font-black uppercase text-black/45 md:grid-cols-[80px_1fr_130px_220px]">
          <span className="hidden md:block">Order</span>
          <span>Category</span>
          <span className="hidden md:block">Status</span>
          <span>Actions</span>
        </div>
        {visibleCategories.map((category) => (
          <div key={category.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-black/10 p-3 last:border-b-0 md:grid-cols-[80px_1fr_130px_220px]">
            <div className="hidden text-sm font-black md:block">{category.sortOrder + 1}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ background: category.colorHex }} />
                <span className="truncate font-black">{category.title}</span>
              </div>
              <div className="truncate text-xs font-bold text-black/45">{category.description}</div>
            </div>
            <div className="hidden text-sm font-bold md:block">{category.isActive ? "Active" : "Inactive"}</div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => void moveCategory(category.id, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void moveCategory(category.id, 1)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => void toggleCategory(category.id, !category.isActive)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Toggle active">
                {category.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <Link href={`/admin/categories/${category.id}`} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Link>
              <Link href={`/admin/categories/${category.id}/levels`} className="min-h-9 rounded-md bg-black px-3 py-2 text-xs font-black uppercase text-white">
                Levels
              </Link>
              <button type="button" onClick={() => void deleteCategory(category.id)} className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50" aria-label="Delete category">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {sortedCategories.length > 0 ? (
        <AdminPagination
          itemLabel="categories"
          page={page}
          pageSize={pageSize}
          totalItems={sortedCategories.length}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
