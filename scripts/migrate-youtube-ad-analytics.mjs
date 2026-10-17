import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const outputDirectory = path.resolve("outputs");
const legacyTargets = new Map([
  ["ZUkw3HyWH8g", "Jasiri vedio2.mp4"],
  ["sII5-F6XXWs", "07be 1284 4e13 9489 6a4aa77a17be.mp4"],
  ["uIxhS4CXZcc", "Simply Organic project 2.mp4"],
  ["m-sBScHcj40", "Lije Care -Zikollab.mp4"],
  ["YLCCIgpqPq8", "Simply organic 1.mp4"],
  ["H-_lNeIS4LE", "Kuri 1.mp4"],
  ["MYBF9rd_uTA", "zurff video 2.mp4"],
  ["H79cfYCjd9w", "Kuri 2.mp4"],
  ["BOi-E438anQ", "zurff video 1.mp4"],
  ["HO6KecMOZYc", "Kine Modu   TG AD.mp4"]
]);
const obsoleteLegacyIds = ["PgvDT0qYBqQ", "Ow_JSNRLsB4", "fey8bg5naYo"];
const allLegacyIds = [...legacyTargets.keys(), ...obsoleteLegacyIds];

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getVideoAdId(url) {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const lastSegment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
  const filename = lastSegment
    ? decodeURIComponent(lastSegment)
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "video"
    : "video";
  return `${filename.slice(0, 55)}-${(hash >>> 0).toString(36)}`;
}

function configuredUrls(value) {
  const candidates = [];
  if (Array.isArray(value?.ads)) candidates.push(...value.ads.map((ad) => ad?.url));
  if (Array.isArray(value?.urls)) candidates.push(...value.urls);
  candidates.push(value?.url);
  return [...new Set(candidates.filter((url) => typeof url === "string" && url.trim()).map((url) => url.trim()))];
}

async function fetchLegacyRows(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("youtube_ad_views")
      .select("id,player_id,video_id,video_url,started_at,completed_at,watched_seconds")
      .in("video_id", allLegacyIds)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const supabase = createClient(
  requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: configRow, error: configError } = await supabase
  .from("game_config")
  .select("value")
  .eq("key", "youtube_ad_config")
  .single();
if (configError) throw new Error(configError.message);

const urls = configuredUrls(configRow.value);
const urlByFilename = new Map(
  urls.map((url) => [decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "").toLowerCase(), url])
);
const resolvedTargets = new Map();
for (const [legacyId, filename] of legacyTargets) {
  const targetUrl = urlByFilename.get(filename.toLowerCase());
  if (!targetUrl) throw new Error(`Configured Supabase video not found for ${filename}.`);
  resolvedTargets.set(legacyId, { videoId: getVideoAdId(targetUrl), videoUrl: targetUrl });
}

const legacyRows = await fetchLegacyRows(supabase);
const summary = {
  apply,
  matchedRows: legacyRows.filter((row) => resolvedTargets.has(row.video_id)).length,
  obsoleteRows: legacyRows.filter((row) => obsoleteLegacyIds.includes(row.video_id)).length,
  mappings: Object.fromEntries(resolvedTargets),
  obsoleteLegacyIds
};

if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

fs.mkdirSync(outputDirectory, { recursive: true });
const backupPath = path.join(
  outputDirectory,
  `legacy-youtube-ad-views-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);
fs.writeFileSync(backupPath, `${JSON.stringify(legacyRows, null, 2)}\n`, "utf8");

const updated = {};
for (const [legacyId, target] of resolvedTargets) {
  const { count, error } = await supabase
    .from("youtube_ad_views")
    .update({ video_id: target.videoId, video_url: target.videoUrl }, { count: "exact" })
    .eq("video_id", legacyId);
  if (error) throw new Error(`${legacyId}: ${error.message}`);
  updated[legacyId] = count ?? 0;
}

const { count: deleted, error: deleteError } = await supabase
  .from("youtube_ad_views")
  .delete({ count: "exact" })
  .in("video_id", obsoleteLegacyIds);
if (deleteError) throw new Error(deleteError.message);

const { count: remainingLegacyRows, error: verifyError } = await supabase
  .from("youtube_ad_views")
  .select("id", { count: "exact", head: true })
  .in("video_id", allLegacyIds);
if (verifyError) throw new Error(verifyError.message);
if (remainingLegacyRows !== 0) throw new Error(`${remainingLegacyRows} legacy rows remain after migration.`);

console.log(
  JSON.stringify(
    {
      ...summary,
      backupPath,
      updated,
      deleted: deleted ?? 0,
      remainingLegacyRows
    },
    null,
    2
  )
);
