"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { createRemoteCategory, fetchRemoteContent } from "@/lib/admin-client";
import { useContentStore } from "@/store/contentStore";
import type { CategoryFormValues } from "@/lib/types";

export default function NewCategoryPage() {
  const router = useRouter();
  const replaceContent = useContentStore((state) => state.replaceContent);

  async function createCategory(values: CategoryFormValues) {
    try {
      const remote = await createRemoteCategory(values);
      const content = await fetchRemoteContent();
      replaceContent(content);
      toast.success("Category created");
      router.push(`/admin/categories/${remote.data.id}/levels`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create category.");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-black uppercase text-black/45">Categories</p>
        <h1 className="font-display text-4xl font-black">New Category</h1>
      </div>
      <CategoryForm submitLabel="Create Category" onSubmit={createCategory} />
    </div>
  );
}
