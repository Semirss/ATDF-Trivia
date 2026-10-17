"use client";

import { useEffect, useState } from "react";
import { FolderKanban, HelpCircle, Layers3, ShieldCheck, Users } from "lucide-react";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { CategoryBreakdownChart } from "@/components/admin/CategoryBreakdownChart";
import { StatsCard } from "@/components/admin/StatsCard";
import { fetchAdminOverview } from "@/lib/admin-client";
import type { AdminOverview } from "@/lib/types";

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setIsRefreshing(true);
      try {
        const data = await fetchAdminOverview();
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    function refreshWhenVisible() {
      if (!document.hidden) {
        void loadOverview();
      }
    }

    void loadOverview();
    const refreshInterval = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const totals = overview?.totals;
  const performance = overview?.performance;
  const summaryItems = [
    { label: "Total Score", value: performance?.totalScore ?? "...", detail: "All player progress combined" },
    { label: "Accuracy", value: performance ? `${performance.accuracyPercent}%` : "...", detail: "Correct answers across live play" },
    { label: "Verified", value: totals?.verifiedPlayers ?? "...", detail: "Reward profiles completed" },
    { label: "Messages", value: totals?.messages ?? "...", detail: "Chat items awaiting moderation" },
    { label: "Pending Rewards", value: totals?.rewardsPending ?? "...", detail: "Outstanding fulfillment items" }
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-gray-900 tracking-tight">Overview</h1>
        </div>
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
          <div className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
          {isRefreshing && overview ? "Refreshing" : "Live"}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-[22px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard label="Categories" value={totals?.categories ?? "..."} detail="Configured game tracks" icon={FolderKanban} />
        <StatsCard label="Levels" value={totals?.levels ?? "..."} detail={`${totals?.activeLevels ?? "..."} active right now`} icon={Layers3} />
        <StatsCard label="Questions" value={totals?.questions ?? "..."} detail={`${totals?.activeQuestions ?? "..."} active in play`} icon={HelpCircle} />
        <StatsCard label="Players" value={totals?.players ?? "..."} detail="Registered player records" icon={Users} />
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Performance</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {summaryItems.map((item, index) => (
            <div
              key={item.label}
              className={`xl:border-l xl:pl-5 ${index === 0 ? "xl:border-l-0 xl:pl-0" : "xl:border-gray-200"}`}
            >
              <div className="text-sm font-medium text-gray-500">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900 tracking-tight">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.24fr_0.76fr]">
        <ActivityChart
          data={overview?.activity ?? []}
          totalPlayers={overview?.activePlayersLast7Days}
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Snapshot</h2>
          </div>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="text-sm font-medium text-gray-600">Avg Player Score</div>
              <div className="text-xl font-semibold text-gray-900">{performance?.averagePlayerScore ?? "..."}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="text-sm font-medium text-gray-600">Total Answers</div>
              <div className="text-xl font-semibold text-gray-900">{performance?.totalAnswers ?? "..."}</div>
            </div>
            <div className="px-5 py-4">
              <div className="text-sm font-medium text-gray-600">Active Content</div>
              <div className="mt-1 text-base font-medium text-gray-900">
                {totals ? `${totals.activeCategories} categories, ${totals.activeLevels} levels, ${totals.activeQuestions} questions` : "..."}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <CategoryBreakdownChart items={overview?.categoryBreakdown ?? []} />
      </div>
    </div>
  );
}
