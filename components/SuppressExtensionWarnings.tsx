"use client";

import { useEffect } from "react";

/**
 * Silences the React hydration warning caused by browser security extensions
 * (e.g. Bitdefender) that inject `bis_skin_checked` into every <div> on the
 * client side. The mismatch is harmless; the extension attribute does not
 * exist on the server HTML, but React logs a noisy warning for each element.
 *
 * `suppressHydrationWarning` only covers individual elements; adding it to
 * every div is impractical, so we filter the warning at the console level
 * instead. Only the specific `bis_skin_checked` message is swallowed; all
 * other React warnings remain visible.
 */
export function SuppressExtensionWarnings() {
  useEffect(() => {
    const original = console.error.bind(console);

    console.error = (...args: unknown[]) => {
      // Filter the bis_skin_checked hydration noise from browser extensions.
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (msg.includes("bis_skin_checked")) return;
      original(...args);
    };

    return () => {
      console.error = original;
    };
  }, []);

  return null;
}
