import { NextResponse } from "next/server";
import { mapPlayer } from "@/lib/data-mappers";
import { invalidateLeaderboardCache } from "@/lib/supabase/game-content-cache";
import { ensureStorageBucket, sanitizeUploadFileName } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const playerId = String(formData.get("playerId") || "").trim();
    const file = formData.get("file");

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Avatar file is required." }, { status: 400 });
    }

    const { supabase, bucket } = await ensureStorageBucket();
    const fileName = sanitizeUploadFileName(file.name);
    const storagePath = `players/avatars/${playerId}-${Date.now()}-${fileName}`;
    const upload = await supabase.storage.from(bucket).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const updatedPlayer = await supabase
      .from("players")
      .update({
        avatar_url: publicUrl.publicUrl
      })
      .eq("id", playerId)
      .select("*")
      .single();

    if (updatedPlayer.error || !updatedPlayer.data) {
      return NextResponse.json({ error: updatedPlayer.error?.message ?? "Unable to save avatar." }, { status: 500 });
    }

    invalidateLeaderboardCache();
    return NextResponse.json({ data: mapPlayer(updatedPlayer.data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload avatar.";
    const status = message === "Supabase is not configured." ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
