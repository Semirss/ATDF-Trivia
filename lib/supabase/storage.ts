import { createServiceSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_BUCKET = "trivia-assets";

export function getStorageBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export async function ensureStorageBucket() {
  const supabase = await createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const bucket = getStorageBucketName();
  const existing = await supabase.storage.getBucket(bucket);

  if (!existing.data && existing.error) {
    const created = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: "10MB"
    });

    if (created.error) {
      throw new Error(created.error.message);
    }
  }

  return {
    supabase,
    bucket
  };
}

export function sanitizeUploadFileName(fileName: string) {
  const sanitized = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "asset";
}
