const publicStoragePath = "/storage/v1/object/public/";

export function isSupabaseStorageVideoUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase().endsWith(".supabase.co") &&
      url.pathname.startsWith(publicStoragePath) &&
      url.pathname.length > publicStoragePath.length
    );
  } catch {
    return false;
  }
}

export function getVideoAdId(value: string) {
  const url = value.trim();
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let filename = "video";
  try {
    const lastSegment = new URL(url).pathname.split("/").filter(Boolean).at(-1);
    if (lastSegment) {
      filename =
        decodeURIComponent(lastSegment)
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[^a-z0-9_-]+/gi, "-")
          .replace(/^-+|-+$/g, "") || "video";
    }
  } catch {
    // Invalid URLs are rejected by the API; keep a stable fallback for callers.
  }

  return `${filename.slice(0, 55)}-${(hash >>> 0).toString(36)}`;
}

export function getConfiguredSupabaseVideoUrls(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const config = value as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(config.ads)) {
    for (const ad of config.ads) {
      if (ad && typeof ad === "object" && !Array.isArray(ad)) {
        candidates.push((ad as Record<string, unknown>).url);
      }
    }
  }

  if (Array.isArray(config.urls)) {
    candidates.push(...config.urls);
  }
  candidates.push(config.url);

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!isSupabaseStorageVideoUrl(candidate)) {
      continue;
    }
    const url = candidate.trim();
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}
