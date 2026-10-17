"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Trophy, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { CHAT_READ_EVENT, getLastChatReadAt, markChatReadAt } from "@/lib/chat-state";
import { t, type UiTextKey } from "@/lib/i18n";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";

const items = [
  { href: "/",            labelKey: "navHome", icon: Home          },
  { href: "/leaderboard", labelKey: "navRank", icon: Trophy        },
  { href: "/messages",    labelKey: "navChat", icon: MessageCircle },
  { href: "/profile",     labelKey: "navMe",   icon: UserRound     },
] satisfies Array<{
  href: string;
  labelKey: UiTextKey;
  icon: typeof Home;
}>;

export function BottomNav() {
  const pathname = usePathname();
  const messages = useContentStore((state) => state.messages);
  const playerId = usePlayerStore((state) => state.playerId);
  const language = usePlayerStore((state) => state.language);
  const [lastReadAt, setLastReadAt] = useState("");
  const latestMessageAt = messages[0]?.postedAt;

  useEffect(() => {
    setLastReadAt(getLastChatReadAt());

    function syncLastRead() {
      setLastReadAt(getLastChatReadAt());
    }

    window.addEventListener(CHAT_READ_EVENT, syncLastRead);
    window.addEventListener("storage", syncLastRead);

    return () => {
      window.removeEventListener(CHAT_READ_EVENT, syncLastRead);
      window.removeEventListener("storage", syncLastRead);
    };
  }, []);

  useEffect(() => {
    if (pathname === "/messages") {
      markChatReadAt(latestMessageAt);
      setLastReadAt(latestMessageAt ?? "");
    }
  }, [latestMessageAt, pathname]);

  const unreadCount = useMemo(
    () =>
      messages.filter((message) => {
        if (message.playerId === playerId) {
          return false;
        }

        return message.postedAt > lastReadAt;
      }).length,
    [lastReadAt, messages, playerId]
  );

  return (
    <nav className="bottom-nav absolute inset-x-3 z-40 flex flex-col justify-center overflow-hidden rounded-[28px] px-2 py-0 shadow-engine backdrop-blur-2xl">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/category/")
              : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-label={t(language, item.labelKey)}
              className="pressable relative flex flex-col items-center gap-1 py-2"
            >
              {/* Active background pill */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="bottom-nav-active-pill absolute inset-x-1 inset-y-0 h-40 w-22 rounded-[50px]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              {/* Icon container */}
              <span
                className={cn(
                  "relative z-10 grid h-8 w-8 place-items-center rounded-full transition-all duration-200",
                  isActive
                    ? "bg-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.28)]"
                    : "bottom-nav-icon bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors duration-200",
                    isActive ? "text-cyan-200" : "bottom-nav-inactive"
                  )}
                />
                {item.href === "/messages" && unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 z-20 grid min-h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[9px] font-black leading-none text-white shadow-bevel">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </span>

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 text-[9.5px] font-black uppercase tracking-[0.07em] transition-colors duration-200",
                  isActive ? "bottom-nav-label-active" : "bottom-nav-inactive"
                )}
              >
                {t(language, item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
