import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(projectRoot, "public", "generated", "atdf-2026-v2", "optimized");
const backupRoot = path.join(projectRoot, "outputs", "category-visual-backups");
const storagePrefix = "atdf-content/2026-visual-refresh-v3";
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim()
  || process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim()
  || "trivia-assets";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const assets = [
  { title: "Pharmaceuticals", slug: "pharmaceuticals" },
  { title: "Automotive", slug: "automotive" },
  { title: "Textile and apparel", slug: "textile-and-apparel" },
  { title: "Logistics", slug: "logistics" },
  { title: "Agro processing", slug: "agro-processing" }
];

async function upload(storagePath, localPath, contentType) {
  const body = await readFile(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType,
    cacheControl: "31536000",
    upsert: true
  });
  if (error) throw new Error(`Asset upload failed (${storagePath}): ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

const { data: categories, error: categoryError } = await supabase
  .from("categories")
  .select("id,title,icon_url,card_background_url,map_background_url,level_podium_url")
  .in("title", assets.map((asset) => asset.title));

if (categoryError) throw new Error(`Could not load categories: ${categoryError.message}`);
if (categories?.length !== assets.length) {
  throw new Error(`Expected ${assets.length} matching categories but found ${categories?.length ?? 0}.`);
}

await mkdir(backupRoot, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = path.join(backupRoot, `before-2026-visual-refresh-v3-${stamp}.json`);
await writeFile(backupPath, JSON.stringify(categories, null, 2), "utf8");

for (const asset of assets) {
  const iconUrl = await upload(
    `${storagePrefix}/icons/${asset.slug}.png`,
    path.join(assetRoot, "icons", `${asset.slug}.png`),
    "image/png"
  );
  const cardUrl = await upload(
    `${storagePrefix}/cards/${asset.slug}.jpg`,
    path.join(assetRoot, "cards", `${asset.slug}.jpg`),
    "image/jpeg"
  );
  const mapUrl = await upload(
    `${storagePrefix}/maps/${asset.slug}.jpg`,
    path.join(assetRoot, "maps", `${asset.slug}.jpg`),
    "image/jpeg"
  );
  const podiumUrl = await upload(
    `${storagePrefix}/podiums/${asset.slug}.png`,
    path.join(assetRoot, "podiums", `${asset.slug}.png`),
    "image/png"
  );

  const category = categories.find((row) => row.title === asset.title);
  const { error } = await supabase
    .from("categories")
    .update({
      icon_url: iconUrl,
      card_background_url: cardUrl,
      map_background_url: mapUrl,
      level_podium_url: podiumUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", category.id);

  if (error) throw new Error(`Category update failed (${asset.title}): ${error.message}`);
  console.log(`Updated ${asset.title}`);
}

console.log(`Category visual assets updated. Backup: ${backupPath}`);
