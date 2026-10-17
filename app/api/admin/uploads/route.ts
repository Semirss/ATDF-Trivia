import { NextResponse } from "next/server";
import { ensureStorageBucket, sanitizeUploadFileName } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "admin-assets").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
    }

    const { supabase, bucket } = await ensureStorageBucket();
    const fileName = sanitizeUploadFileName(file.name);
    const storagePath = `${folder}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
    const upload = await supabase.storage.from(bucket).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return NextResponse.json({
      data: {
        url: data.publicUrl,
        path: storagePath,
        bucket
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload asset.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
