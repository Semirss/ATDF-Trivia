"use client";
/* eslint-disable @next/next/no-img-element */

import { BadgeCheck, Crown } from "lucide-react";
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

function LeaderboardRowCard({ row, verifiedLabel, pointsLabel, own }: { row: LeaderboardRow; verifiedLabel: string; pointsLabel: string; own: boolean }) {
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
        <strong>{row.totalScore} {pointsLabel}</strong>
        <span>{row.completionPercent}%</span>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const playerId = usePlayerStore((state) => state.playerId);
  const { rows, ownRow, isLoading, error } = useLeaderboard(playerId ?? undefined);
  const language = usePlayerStore((state) => state.language);
  const topThree = rows.slice(0, 3);
  const podiumRows = [topThree[1], topThree[0], topThree[2]].filter(Boolean) as LeaderboardRow[];
  const rest = rows.slice(3);
  const verifiedLabel = t(language, "verifiedPlayerAria");
  const pointsLabel = t(language, "pointsShort");

  return (
    <PageTransition>
      <div className="game-safe leaderboard-safe" data-pull-scroll="true">
        <section className="leaderboard-hero">
          <div className="leaderboard-heading">
            <p>{t(language, "globalRank")}</p>
            <h1>{t(language, "leaderboard")}</h1>
            <span />
          </div>

          {error ? <div className="leaderboard-status is-error">{error}</div> : null}

          {!isLoading && rows.length > 0 ? (
            <div className="leaderboard-podium-grid">
              {podiumRows.map((row) => {
                const isWinner = row.globalRank === 1;
                return (
                  <div
                    key={row.playerId}
                    className={`leaderboard-podium-card rank-${row.globalRank} ${isWinner ? "is-winner" : ""}`}
                  >
                    <span className="leaderboard-medal">
                      {isWinner ? <Crown className="leaderboard-crown" aria-hidden="true" /> : null}
                      <span>{row.globalRank}</span>
                    </span>
                    <PlayerAvatar row={row} priority className="leaderboard-podium-avatar" />
                    <div className="leaderboard-podium-name"><VerifiedName row={row} label={verifiedLabel} /></div>
                    <strong className="leaderboard-podium-score">{row.totalScore} {pointsLabel}</strong>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {!isLoading && rows.length > 0 ? (
          <section className="leaderboard-list">
            {rest.map((row) => (
              <div key={row.playerId}>
                <LeaderboardRowCard row={row} verifiedLabel={verifiedLabel} pointsLabel={pointsLabel} own={row.playerId === playerId} />
              </div>
            ))}
          </section>
        ) : null}
      </div>

      {!isLoading && ownRow ? (
        <aside className="leaderboard-own-sticky" aria-label={t(language, "globalRank")}>
          <div className="leaderboard-own-card">
            <span className="leaderboard-own-rank">{ownRow.globalRank}</span>
            <PlayerAvatar row={ownRow} priority className="leaderboard-own-avatar" />
            <div className="leaderboard-own-main">
              <span className="leaderboard-own-meta">{t(language, "globalRank")}</span>
              <div className="leaderboard-own-name"><VerifiedName row={ownRow} label={verifiedLabel} /></div>
              <span className="leaderboard-own-track">
                <i
                  className="leaderboard-own-progress"
                  style={{ width: `${Math.max(ownRow.completionPercent, 4)}%` }}
                />
              </span>
            </div>
            <div className="leaderboard-own-score">
              <strong>{ownRow.totalScore} {t(language, "pointsShort")}</strong>
              <span>{ownRow.completionPercent}%</span>
            </div>
          </div>
        </aside>
      ) : null}
    </PageTransition>
  );
}
