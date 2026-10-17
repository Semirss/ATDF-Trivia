"use client";
/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { t } from "@/lib/i18n";
import { usePlayerStore } from "@/store/playerStore";
import type { LeaderboardRow } from "@/lib/types";

function PlayerAvatar({ row, className, priority = false }: { row: LeaderboardRow; className: string; priority?: boolean }) {
  return (
    <div className={className}>
      {row.avatarUrl ? (
        <img
          src={row.avatarUrl}
          alt={row.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center font-display font-black">
          {row.name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function VerifiedName({ row, label }: { row: LeaderboardRow; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="truncate">{row.name}</span>
      {row.isVerified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-[#159de3] text-white" aria-label={label} /> : null}
    </div>
  );
}

function LeaderboardRowCard({ row, verifiedLabel, own }: { row: LeaderboardRow; verifiedLabel: string; own: boolean }) {
  return (
    <div className={`leaderboard-row-card ${own ? "is-own" : ""}`}>
      <span className="leaderboard-row-rank">{row.globalRank}</span>
      <PlayerAvatar row={row} className="leaderboard-row-avatar" />
      <div className="leaderboard-row-main">
        <div className="leaderboard-row-name"><VerifiedName row={row} label={verifiedLabel} /></div>
        <span className="leaderboard-row-track">
          <i style={{ width: `${Math.max(row.completionPercent, 4)}%` }} />
        </span>
      </div>
      <div className="leaderboard-row-score">
        <strong>{row.totalScore} pts</strong>
        <span>{row.completionPercent}%</span>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { rows, isLoading, error } = useLeaderboard();
  const playerId = usePlayerStore((state) => state.playerId);
  const language = usePlayerStore((state) => state.language);
  const topThree = rows.slice(0, 3);
  const podiumRows = [topThree[1], topThree[0], topThree[2]].filter(Boolean) as LeaderboardRow[];
  const rest = rows.slice(3);
  const verifiedLabel = t(language, "verifiedPlayerAria");

  return (
    <PageTransition>
      <div className="game-safe leaderboard-safe" data-pull-scroll="true">
        <section className="leaderboard-hero">
          <div className="leaderboard-heading">
            <p>{t(language, "globalRank")}</p>
            <h1>{t(language, "leaderboard")}</h1>
            <span />
          </div>

          {isLoading ? <div className="leaderboard-status">{t(language, "loadingLeaderboard")}</div> : null}
          {error ? <div className="leaderboard-status is-error">{error}</div> : null}

          <div className="leaderboard-podium-grid">
            {podiumRows.map((row, index) => {
              const isWinner = row.globalRank === 1;
              return (
                <motion.div
                  key={row.playerId}
                  initial={{ opacity: 0, y: 34 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07, type: "spring" }}
                  className={`leaderboard-podium-card rank-${row.globalRank} ${isWinner ? "is-winner" : ""}`}
                >
                  <span className="leaderboard-medal">{row.globalRank}</span>
                  <PlayerAvatar row={row} priority={isWinner} className="leaderboard-podium-avatar" />
                  <div className="leaderboard-podium-name"><VerifiedName row={row} label={verifiedLabel} /></div>
                  <strong className="leaderboard-podium-score">{row.totalScore} pts</strong>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="leaderboard-list">
          {rest.map((row, index) => (
            <motion.div
              key={row.playerId}
              initial={index < 10 ? { opacity: 0, x: 12 } : false}
              animate={index < 10 ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: Math.min(index, 8) * 0.025 }}
            >
              <LeaderboardRowCard row={row} verifiedLabel={verifiedLabel} own={row.playerId === playerId} />
            </motion.div>
          ))}
        </section>
      </div>
    </PageTransition>
  );
}
