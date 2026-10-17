"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { useContentSync } from "@/hooks/useContentSync";
import { fetchRemoteContent, updateRemoteCategory } from "@/lib/admin-client";
import { useContentStore } from "@/store/contentStore";
import type { CategoryFormValues } from "@/lib/types";

export default function EditCategoryPage({ params }: { params: { id: string } }) {
  useContentSync();
  const router = useRouter();
  const isLoaded = useContentStore((state) => state.isLoaded);
  const category = useContentStore((state) => state.categories.find((item) => item.id === params.id));
  const replaceContent = useContentStore((state) => state.replaceContent);

  if (!isLoaded && !category) {
    return <div className="rounded-lg bg-white p-6 font-black">Loading category...</div>;
  }

  if (!category) {
    return <div className="rounded-lg bg-white p-6 font-black">Category not found.</div>;
  }

  async function save(values: CategoryFormValues) {
    try {
      await updateRemoteCategory(params.id, values);
      const content = await fetchRemoteContent();
      replaceContent(content);
      toast.success("Category saved");
      router.push("/admin/categories");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save category.");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-black uppercase text-black/45">Categories</p>
        <h1 className="font-display text-4xl font-black">Edit {category.title}</h1>
      </div>
      <CategoryForm category={category} submitLabel="Save Category" onSubmit={save} />
    </div>
  );
}
