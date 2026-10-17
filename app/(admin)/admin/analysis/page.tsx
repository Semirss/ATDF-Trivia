"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  Eye,
  Gamepad2,
  MousePointerClick,
  PlayCircle,
  Trophy,
  UsersRound
} from "lucide-react";
import { fetchAdminAnalytics } from "@/lib/admin-client";
import { csvTimestamp, downloadCsv, type CsvValue } from "@/lib/csv";
import type { AdminAnalyticsRow, AdminAnalyticsSummary } from "@/lib/types";

const palette = {
  ink: "#111827",
  cyan: "#22d3ee",
  mint: "#34d399",
  honey: "#fbbf24"
};

// Visibility toggle — set to true to make visible again later
const SHOW_TOP_BUTTONS = false;

function ExportButton({ label, headers, rows }: { label: string; headers: string[]; rows: CsvValue[][] }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsv(`${label}-${csvTimestamp()}.csv`, headers, rows)}
      disabled={rows.length === 0}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-gray-700 shadow-sm disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" />
      CSV
    </button>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-gray-500">{label}</div>
          <div className="mt-1 text-3xl font-black tracking-tight text-gray-950">{value.toLocaleString()}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ backgroundColor: accent }}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-2 text-[11px] font-medium text-gray-500">{detail}</div>
    </div>
  );
}

function ActivityChart({ days }: { days: AdminAnalyticsSummary["recentDays"] }) {
  const width = 720;
  const height = 210;
  const padX = 34;
  const padY = 24;
  const totals = days.map((day) => day.buttonTaps + day.gamesPlayed + day.levelsCompleted);
  const max = Math.max(1, ...totals);
  const points = totals.map((total, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, totals.length - 1);
    const y = height - padY - (total / max) * (height - padY * 2);
    return { x, y, total, date: days[index]?.date ?? "" };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity className="h-4.5 w-4.5 text-cyan-500" />
        <div>
          <h2 className="text-base font-black text-gray-950">Seven-day activity</h2>
          <p className="text-xs font-medium text-gray-500">Combined taps, starts, and level clears.</p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height + 34}`} className="min-w-[620px]" role="img" aria-label="Seven-day activity line graph">
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.cyan} stopOpacity="0.36" />
              <stop offset="100%" stopColor={palette.cyan} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((part) => (
            <line
              key={part}
              x1={padX}
              x2={width - padX}
              y1={height - padY - part * (height - padY * 2)}
              y2={height - padY - part * (height - padY * 2)}
              stroke="#e5e7eb"
              strokeDasharray="4 5"
            />
          ))}
          <polygon points={area} fill="url(#activity-fill)" />
          <polyline points={line} fill="none" stroke={palette.ink} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point) => (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} r="5" fill={palette.cyan} stroke="white" strokeWidth="3" />
              <text x={point.x} y={Math.max(14, point.y - 12)} textAnchor="middle" className="fill-gray-900 text-[10px] font-black">
                {point.total}
              </text>
              <text x={point.x} y={height + 14} textAnchor="middle" className="fill-gray-500 text-[10px] font-bold">
                {point.date.slice(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function EventMixChart({ totals }: { totals: AdminAnalyticsSummary["totals"] }) {
  const values = [totals.buttonTaps, totals.gamesPlayed, totals.levelsCompleted];
  const total = Math.max(1, values.reduce((sum, value) => sum + value, 0));
  const tapEnd = (values[0] / total) * 100;
  const gameEnd = tapEnd + (values[1] / total) * 100;
  const background = `conic-gradient(${palette.ink} 0 ${tapEnd}%, ${palette.cyan} ${tapEnd}% ${gameEnd}%, ${palette.honey} ${gameEnd}% 100%)`;
  const legend = [
    ["Button taps", totals.buttonTaps, palette.ink],
    ["Game starts", totals.gamesPlayed, palette.cyan],
    ["Level clears", totals.levelsCompleted, palette.honey]
  ] as const;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-black text-gray-950">Engagement mix</h2>
      <p className="text-xs font-medium text-gray-500">Share of tracked interaction types.</p>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background }}>
          <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner">
            <div>
              <div className="text-2xl font-black text-gray-950">{total.toLocaleString()}</div>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">Events</div>
            </div>
          </div>
        </div>
        <div className="w-full space-y-2">
          {legend.map(([label, value, color]) => (
            <div key={label} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 text-xs font-bold text-gray-600">{label}</span>
              <span className="text-sm font-black text-gray-950">{Math.round((value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventTable({ title, rows, emptyText, filename }: { title: string; rows: AdminAnalyticsRow[]; emptyText: string; filename: string }) {
  const csvRows = rows.map((row) => [row.label, row.path, row.count, row.eventDate, row.lastSeenAt]);
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-gray-950">{title}</h2>
        <ExportButton label={filename} headers={["Label", "Path", "Count", "Date", "Last Seen"]} rows={csvRows} />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
        {rows.slice(0, 10).map((row, index) => (
          <div key={`${row.eventDate}-${row.eventType}-${row.eventKey}-${row.path}`} className="grid grid-cols-[28px_minmax(0,1fr)_64px] items-center gap-2 border-t border-gray-100 px-2.5 py-2 first:border-t-0">
            <span className="text-[10px] font-black text-gray-400">{index + 1}</span>
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-gray-900">{row.label}</div>
              <div className="truncate text-[10px] font-medium text-gray-500">{row.path}</div>
            </div>
            <div className="text-right text-sm font-black text-gray-950">{row.count.toLocaleString()}</div>
          </div>
        ))}
        {rows.length === 0 ? <div className="px-3 py-7 text-center text-xs font-semibold text-gray-500">{emptyText}</div> : null}
      </div>
    </section>
  );
}

export default function AdminAnalysisPage() {
  const [analytics, setAnalytics] = useState<AdminAnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAdminAnalytics()
      .then((data) => {
        if (active) {
          setAnalytics(data);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const maxPlayerSessions = useMemo(
    () => Math.max(1, ...(analytics?.topPlayersBySessions.map((player) => player.sessionCount) ?? [1])),
    [analytics]
  );

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">{error}</div>;
  }

  if (!analytics) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-5 font-semibold text-gray-500 shadow-sm">Loading analytics…</div>;
  }

  const sessionCsv = analytics.topPlayersBySessions.map((player) => [
    player.playerId,
    player.name,
    player.sessionCount,
    player.lastPlayedAt ?? ""
  ]);
  const questionCsv = analytics.questionSubmissions.map((submission) => [
    submission.questionNumber,
    submission.questionText,
    submission.playerName || "Anonymous",
    submission.playerId ?? "",
    submission.source,
    submission.createdAt
  ]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Performance intelligence</p>
        <h1 className="text-2xl font-black tracking-tight text-gray-950">Analytics dashboard</h1>
        <p className="mt-1 text-xs font-medium text-gray-500">Player behavior, engagement trends, and advertising performance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <MetricCard label="Button Taps" value={analytics.totals.buttonTaps} detail="All button, option & navigation clicks" icon={MousePointerClick} accent={palette.ink} />
        <MetricCard label="Games Played" value={analytics.totals.gamesPlayed} detail="Anonymous level starts" icon={Gamepad2} accent="#475569" />
        <MetricCard label="Levels Cleared" value={analytics.totals.levelsCompleted} detail="Successful completions" icon={Trophy} accent={palette.honey} />
        <MetricCard label="Player Sessions" value={analytics.totals.playerSessions} detail="Account-linked starts" icon={UsersRound} accent={palette.mint} />
        <MetricCard label="Ad Views" value={analytics.totals.adViews} detail="Video ad impressions" icon={Eye} accent={palette.cyan} />
        {/* <MetricCard label="Ad Completions" value={analytics.totals.completedAdViews} detail="Ads watched through continue" icon={PlayCircle} accent="#8b5cf6" /> */}
        <MetricCard label="Questions Asked" value={analytics.totals.questionSubmissions} detail="Submitted through Your Question" icon={Activity} accent="#f97316" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.65fr)]">
        <ActivityChart days={analytics.recentDays} />
        <EventMixChart totals={analytics.totals} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-950">Player sessions</h2>
              <p className="text-xs font-medium text-gray-500">Level starts associated with each player.</p>
            </div>
            <ExportButton label="player-sessions" headers={["Player ID", "Player", "Sessions", "Last Played"]} rows={sessionCsv} />
          </div>
          <div className="mt-3 space-y-2">
            {analytics.topPlayersBySessions.slice(0, 12).map((player, index) => (
              <div key={player.playerId} className="grid grid-cols-[24px_minmax(0,1fr)_54px] items-center gap-2">
                <span className="text-[10px] font-black text-gray-400">{index + 1}</span>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-black text-gray-900">{player.name}</span>
                    <span className="font-bold text-gray-500">{player.lastPlayedAt ? new Date(player.lastPlayedAt).toLocaleDateString() : "Not yet"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-gray-950 to-emerald-400" style={{ width: `${(player.sessionCount / maxPlayerSessions) * 100}%` }} />
                  </div>
                </div>
                <span className="text-right text-sm font-black text-gray-950">{player.sessionCount}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-gray-950">Video ad performance</h2>
              <p className="text-xs font-medium text-gray-500">Views and completed plays for each configured video.</p>
            </div>
            <ExportButton
              label="video-ad-performance"
              headers={["Video ID", "URL", "Views","Watched Seconds"]}
              rows={analytics.adVideos.map((video) => [
                video.videoId,
                video.videoUrl,
                video.views,
                video.watchedSeconds,
              ])}
            />
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
            <div className="grid grid-cols-[minmax(0,1fr)_80px_100px] bg-gray-50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-gray-500">
              <span>Video</span>
              <span className="text-right">Views</span>
              {/* <span className="text-right">Completed</span> */}
            </div>
            {analytics.adVideos.map((video) => (
              <div
                key={video.videoId}
                className="grid grid-cols-[minmax(0,1fr)_80px_100px] items-center border-t border-gray-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-gray-900">{video.videoId}</div>
                  <div className="truncate text-[10px] font-medium text-gray-500">{video.videoUrl}</div>
                </div>
                <span className="text-right text-sm font-black">{video.views}</span>
                {/* <span className="text-right text-sm font-black">{video.completedViews}</span> */}
              </div>
            ))}
            {analytics.adVideos.length === 0 ? (
              <div className="border-t border-gray-100 px-4 py-8 text-center text-xs font-semibold text-gray-500">No ad views recorded yet.</div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-950">Submitted questions</h2>
            <p className="text-xs font-medium text-gray-500">
              {analytics.totals.questionSubmissions.toLocaleString()} questions submitted through the Your Question form.
            </p>
          </div>
          <ExportButton
            label="submitted-questions"
            headers={["Question #", "Question", "Player", "Player ID", "Source", "Submitted At"]}
            rows={questionCsv}
          />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[72px_minmax(300px,1fr)_170px_170px] bg-gray-50 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-gray-500">
              <span>Number</span>
              <span>Question</span>
              <span>Player</span>
              <span>Submitted</span>
            </div>
            {analytics.questionSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="grid grid-cols-[72px_minmax(300px,1fr)_170px_170px] items-start border-t border-gray-100 px-3 py-3"
              >
                <span className="text-xs font-black text-orange-600">#{submission.questionNumber}</span>
                <span className="whitespace-pre-wrap pr-5 text-sm font-semibold leading-5 text-gray-900">{submission.questionText}</span>
                <span className="truncate pr-3 text-xs font-bold text-gray-600" title={submission.playerName || "Anonymous"}>
                  {submission.playerName || "Anonymous"}
                </span>
                <span className="text-xs font-medium text-gray-500">
                  {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "Unknown"}
                </span>
              </div>
            ))}
            {analytics.questionSubmissions.length === 0 ? (
              <div className="border-t border-gray-100 px-4 py-8 text-center text-xs font-semibold text-gray-500">
                No questions have been submitted yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className={SHOW_TOP_BUTTONS ? "grid gap-4 xl:grid-cols-3" : "grid gap-4 xl:grid-cols-2"}>
        {SHOW_TOP_BUTTONS && (
          <EventTable title="Top buttons" rows={analytics.topButtons} emptyText="No button taps recorded yet." filename="top-buttons" />
        )}
        <EventTable title="Top games" rows={analytics.topGames} emptyText="No game starts recorded yet." filename="top-games" />
        <EventTable title="Top level clears" rows={analytics.topLevels} emptyText="No level completions recorded yet." filename="top-level-clears" />
      </div>
    </div>
  );
}
