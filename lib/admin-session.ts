export const ADMIN_COOKIE_NAME = "trivia_admin";
export const LOCAL_ADMIN_COOKIE_VALUE = "local-dev";

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(hash);
}

export function getAdminAccessCode() {
  return process.env.ADMIN_ACCESS_CODE?.trim() ?? "";
}

export async function createAdminCookieValue(accessCode = getAdminAccessCode()) {
  return `v1.${await digest(accessCode)}`;
}

export async function isAdminCookieValid(cookieValue?: string) {
  const accessCode = getAdminAccessCode();

  if (!accessCode) {
    return cookieValue === LOCAL_ADMIN_COOKIE_VALUE;
  }

  return cookieValue === (await createAdminCookieValue(accessCode));
}
