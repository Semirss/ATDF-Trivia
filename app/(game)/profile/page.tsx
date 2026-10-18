"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, BookOpen, ChevronRight, LoaderCircle, MessageSquare, Settings, ShieldCheck, Target, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { FallbackIcon } from "@/components/game/FallbackIcon";
import { PlayerAccountModal } from "@/components/game/PlayerAccountModal";
import { RewardProfileModal } from "@/components/game/RewardProfileModal";
import { PageTransition } from "@/components/ui/PageTransition";
import { useContentSync } from "@/hooks/useContentSync";
import { fetchGameLeaderboardRow, uploadPlayerAvatar } from "@/lib/game-client";
import { t, type AppLanguage } from "@/lib/i18n";
import { useContentStore } from "@/store/contentStore";
import { usePlayerStore } from "@/store/playerStore";
import type { LeaderboardRow } from "@/lib/types";

function timeAgo(value: string | null | undefined, language: AppLanguage) {
  if (!value) return "-";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days === 0) return t(language, "today");
  if (days === 1) return t(language, "yesterday");
  if (days < 30) return `${days}${language === "en" ? "" : " "}${t(language, "daysAgo")}`;
  return `${Math.floor(days / 30)}${language === "en" ? "" : " "}${t(language, "monthsAgo")}`;
}

export default function ProfilePage() {
  useContentSync();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const categories = useContentStore((state) => state.categories);
  const levels = useContentStore((state) => state.levels);
  const questions = useContentStore((state) => state.questions);
  const messages = useContentStore((state) => state.messages);
  const playerId = usePlayerStore((state) => state.playerId);
  const name = usePlayerStore((state) => state.name);
  const age = usePlayerStore((state) => state.age);
  const avatarUrl = usePlayerStore((state) => state.avatarUrl);
  const createdAt = usePlayerStore((state) => state.createdAt);
  const accountEmail = usePlayerStore((state) => state.accountEmail);
  const source = usePlayerStore((state) => state.source);
  const rewardProfiles = usePlayerStore((state) => state.rewardProfiles);
  const progress = usePlayerStore((state) => state.progress);
  const scoreEvents = usePlayerStore((state) => state.scoreEvents);
  const language = usePlayerStore((state) => state.language);
  const setProfile = usePlayerStore((state) => state.setProfile);
  const [isUploading, setIsUploading] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [rewardProfileOpen, setRewardProfileOpen] = useState(false);
  const [leaderboardRow, setLeaderboardRow] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    let active = true;
    if (!playerId) return () => { active = false; };
    fetchGameLeaderboardRow(playerId)
      .then((row) => active && setLeaderboardRow(row))
      .catch(() => active && setLeaderboardRow(null));
    return () => { active = false; };
  }, [playerId]);

  const playerProgress = progress
    .filter((item) => item.playerId === playerId)
    .sort((a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime());
  const playerMessages = messages.filter((message) => message.playerId === playerId).length;
  const answerCount = leaderboardRow?.questionsAnswered ?? scoreEvents.filter((event) => event.playerId === playerId).length;
  const displayedScore = leaderboardRow?.totalScore ?? playerProgress.reduce((sum, item) => sum + item.score, 0);
  const playedPercent = leaderboardRow?.completionPercent ?? (questions.length ? Math.min(100, Math.round((answerCount / questions.length) * 100)) : 0);
  const currentRun = playerProgress[0];
  const currentCategory = categories.find((category) => category.id === currentRun?.categoryId);
  const categoryLevelCount = levels.filter((level) => level.categoryId === currentRun?.categoryId && level.isActive).length;
  const runProgress = currentRun && categoryLevelCount ? Math.min(100, Math.round((currentRun.levelsCompleted / categoryLevelCount) * 100)) : 0;
  const verifiedProfile = rewardProfiles.find((profile) => profile.playerId === playerId) ?? null;
  const hasSavedProgress = Boolean(accountEmail || source === "telegram");

  async function handleAvatarUpload(file: File) {
    if (!playerId) {
      toast.error(t(language, "createPlayerFirstToast"));
      return;
    }
    setIsUploading(true);
    try {
      const updated = await uploadPlayerAvatar(playerId, file);
      setProfile(updated);
      toast.success(t(language, "avatarUpdated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(language, "uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  const stats = [
    { icon: Trophy, label: t(language, "score"), value: displayedScore, dark: false },
    { icon: Target, label: t(language, "played"), value: `${playedPercent}%`, dark: true },
    { icon: BookOpen, label: t(language, "answers"), value: answerCount, dark: true },
    { icon: MessageSquare, label: t(language, "chats"), value: playerMessages, dark: false }
  ];

  return (
    <PageTransition>
      <div className="game-safe profile-safe" data-pull-scroll="true">
        {accountOpen ? <PlayerAccountModal initialMode="create" onClose={() => setAccountOpen(false)} /> : null}
        {rewardProfileOpen ? <RewardProfileModal onClose={() => setRewardProfileOpen(false)} /> : null}

        <section className="profile-reference-hero">
          <Link href="/settings" className="profile-settings-button" aria-label={t(language, "settingsTitle")}>
            <Settings className="h-[17px] w-[17px]" strokeWidth={2.8} />
          </Link>
          <img src="/visuals/atdf-2026-seal-optimized.png" alt="ATDF 2026" className="profile-seal" />

          <section className="profile-identity">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!playerId || isUploading}
              className="profile-avatar-button"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={name ?? "Player"} className="h-full w-full object-cover" />
              ) : (
                <span>{name?.charAt(0).toUpperCase() || "?"}</span>
              )}
              {isUploading ? <i><LoaderCircle className="h-4 w-4 animate-spin" /></i> : null}
            </button>
            <div className="profile-identity-copy">
              <h1>{name ?? t(language, "newPlayer")}<BadgeCheck aria-hidden="true" /></h1>
              <p>{age ? `${age} ${t(language, "yearsOld")}` : t(language, "completeOnboarding")}</p>
              <p>{t(language, "joined")} {timeAgo(createdAt, language)}</p>
            </div>
          </section>
        </section>

        <main className="profile-content-sheet">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleAvatarUpload(file);
            }}
          />

          {playerId ? (
            <button
              type="button"
              onClick={() => {
                if (!hasSavedProgress) setAccountOpen(true);
                else if (!verifiedProfile) setRewardProfileOpen(true);
              }}
              className="profile-save-card"
            >
              <span><ShieldCheck className="h-5 w-5" /></span>
              <span>
                <strong>{verifiedProfile ? t(language, "progressSaved") : t(language, "saveProgress")}</strong>
                <small>{verifiedProfile ? accountEmail ?? t(language, "telegramAccount") : t(language, "addEmailForLogin")}</small>
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/onboarding" className="profile-save-card">{t(language, "getStarted")}</Link>
          )}

          <section className="profile-stats-grid">
            {stats.map(({ icon: Icon, label, value, dark }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`profile-stat-card ${dark ? "profile-stat-card-accent" : "profile-stat-card-light"}`}
              >
                <Icon className="profile-stat-icon h-5 w-5" />
                <strong>{value}</strong>
                <span>{label}</span>
              </motion.div>
            ))}
          </section>

          <section className="profile-now-playing">
            <h2><span><Zap className="h-4 w-4 fill-current" /></span>{t(language, "nowPlaying")}</h2>
            {currentRun && currentCategory ? (
              <Link href={`/category/${currentCategory.id}`} className="profile-run-card">
                <FallbackIcon id={currentCategory.id} src={currentCategory.iconUrl} alt={currentCategory.title} className="profile-run-icon" />
                <span className="profile-run-copy">
                  <strong>{currentCategory.title}</strong>
                  <small>{t(language, "level")} {currentRun.currentLevel} · {currentRun.currentQuestionIndex + 1}/20 {t(language, "levels")}</small>
                  <span><i style={{ width: `${Math.max(runProgress, 6)}%` }} /></span>
                </span>
                <span className="profile-run-percent"><ChevronRight className="h-4 w-4" />{runProgress}%</span>
              </Link>
            ) : (
              <div className="profile-empty-run">{t(language, "noActiveRuns")}</div>
            )}
          </section>
        </main>
      </div>
    </PageTransition>
  );
}
