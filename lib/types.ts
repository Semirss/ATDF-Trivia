export type Difficulty = "easy" | "medium" | "hard";
export type OptionKey = "a" | "b" | "c" | "d";
export type RewardStatus = "pending" | "claimed" | "expired";
export type YouTubeAdSelectionMode = "rotate" | "shuffle";
export type YouTubeAdTriggerMode = "interval" | "levels";

export interface YouTubeAdItem {
  url: string;
  durationSeconds: number;
  targetLevels?: number[];
}

export interface QuestionTranslation {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  explanation: string;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  avatarUrl?: string;
  telegramId?: string;
  telegramUsername?: string;
  telegramPhone?: string;
  source?: "web" | "telegram";
  createdAt: string;
}

export interface RewardProfile {
  id: string;
  playerId: string;
  fullName: string;
  phone: string;
  email: string;
  telegramUsername: string;
  createdAt: string;
}

export interface Category {
  id: string;
  title: string;
  iconUrl: string;
  difficulty: Difficulty;
  isRewardBased: boolean;
  isActive: boolean;
  sortOrder: number;
  colorHex: string;
  description: string;
  mapBackgroundUrl: string;
  levelPodiumUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryLevel {
  id: string;
  categoryId: string;
  levelNumber: number;
  title: string;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitSeconds: number;
  pointsPerCorrect: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  levelId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  explanation?: string;
  translations?: Record<string, Partial<QuestionTranslation>>;
  mediaUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProgress {
  id: string;
  playerId: string;
  categoryId: string;
  currentLevel: number;
  currentQuestionIndex: number;
  score: number;
  levelsCompleted: number;
  lastPlayedAt: string;
}

export interface ScoreEvent {
  id: string;
  playerId: string;
  categoryId: string;
  levelId: string;
  questionId: string | null;
  isCorrect: boolean;
  points: number;
  answeredAt: string;
}

export interface Reward {
  id: string;
  playerId: string;
  categoryId: string;
  rewardType: string;
  rewardValue: string;
  status: RewardStatus;
  earnedAt: string;
}

export interface Message {
  id: string;
  playerId: string;
  playerName: string;
  avatarUrl?: string;
  text: string;
  postedAt: string;
  replyToMessageId?: string;
}

export interface GameConfig {
  maxStreakBonus: {
    multiplier: number;
    triggerAt: number;
  };
  defaultTimeLimitSeconds: number;
  leaderboardDisplayCount: number;
  youtubeAd: {
    enabled: boolean;
    url: string;
    urls: string[];
    ads: YouTubeAdItem[];
    durationSeconds: number;
    aspectRatio: "normal" | "vertical";
    levelInterval: number;
    selectionMode: YouTubeAdSelectionMode;
    triggerMode: YouTubeAdTriggerMode;
    targetLevels: number[];
  };
}

export interface SavedGameSession {
  id: string;
  playerId: string;
  categoryId: string;
  levelId: string;
  questionIds: string[];
  currentIndex: number;
  sessionScore: number;
  streak: number;
  correctAnswered: number;
  phase: "question" | "answered";
  selectedOption: OptionKey | null;
  isCorrect: boolean | null;
  correctOption: OptionKey | null;
  points: number;
  answerAttempts?: SavedQuestionAnswer[];
  recoveryQuestionIds?: string[];
  updatedAt: string;
}

export interface SavedQuestionAnswer {
  questionId: string;
  selectedOption: OptionKey | null;
  currentStreak: number;
}

export interface GameContent {
  categories: Category[];
  levels: CategoryLevel[];
  questions: Question[];
  messages: Message[];
  rewards: Reward[];
  config: GameConfig;
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  avatarUrl?: string;
  totalScore: number;
  categoriesPlayed: number;
  globalRank: number;
  completionPercent: number;
  questionsAnswered: number;
  totalQuestions: number;
  currentLevelReached: number;
  isVerified: boolean;
}

export interface PlayerSnapshot {
  player: Player;
  rewardProfiles: RewardProfile[];
  progress: PlayerProgress[];
  scoreEvents: ScoreEvent[];
}

export interface AdminActivityPoint {
  date: string;
  players: number;
  messages: number;
  answers: number;
}

export interface AdminCategoryBreakdown {
  categoryId: string;
  title: string;
  colorHex: string;
  difficulty: Difficulty;
  activeLevels: number;
  activeQuestions: number;
  players: number;
  totalScore: number;
}

export interface AdminOverview {
  totals: {
    categories: number;
    activeCategories: number;
    levels: number;
    activeLevels: number;
    questions: number;
    activeQuestions: number;
    players: number;
    verifiedPlayers: number;
    messages: number;
    rewardsPending: number;
    activePlayersLast7Days?: number;
  };
  performance: {
    totalScore: number;
    averagePlayerScore: number;
    totalAnswers: number;
    accuracyPercent: number;
  };
  activity: AdminActivityPoint[];
  activePlayersLast7Days?: number;
  categoryBreakdown: AdminCategoryBreakdown[];
}

export interface AdminAnalyticsRow {
  eventDate: string;
  eventType: "button_tap" | "game_played" | "level_completed";
  eventKey: string;
  label: string;
  path: string;
  count: number;
  lastSeenAt: string;
}

export interface AdminQuestionSubmission {
  id: string;
  questionNumber: number;
  playerId: string | null;
  playerName: string;
  questionText: string;
  source: string;
  createdAt: string;
}

export interface AdminAnalyticsSummary {
  totals: {
    buttonTaps: number;
    gamesPlayed: number;
    levelsCompleted: number;
    playerSessions: number;
    adViews: number;
    completedAdViews: number;
    questionSubmissions: number;
  };
  topButtons: AdminAnalyticsRow[];
  topGames: AdminAnalyticsRow[];
  topLevels: AdminAnalyticsRow[];
  topPlayersBySessions: AdminPlayerSessionRow[];
  adVideos: AdminAdVideoAnalytics[];
  questionSubmissions: AdminQuestionSubmission[];
  recentDays: Array<{
    date: string;
    buttonTaps: number;
    gamesPlayed: number;
    levelsCompleted: number;
  }>;
}

export interface AdminPlayerSessionRow {
  playerId: string;
  name: string;
  avatarUrl?: string;
  sessionCount: number;
  lastPlayedAt: string | null;
}

export interface AdminAdVideoAnalytics {
  videoId: string;
  videoUrl: string;
  views: number;
  completedViews: number;
  completionRate: number;
  watchedSeconds: number;
  lastViewedAt: string | null;
}

export interface AdminPlayerSummary {
  id: string;
  name: string;
  age: number;
  avatarUrl?: string;
  createdAt: string;
  totalScore: number;
  categoriesPlayed: number;
  levelsCompleted: number;
  messageCount: number;
  sessionCount: number;
  rewardVerified: boolean;
  lastPlayedAt: string | null;
}

export interface AdminPlayerProgressItem {
  categoryId: string;
  categoryTitle: string;
  categoryColorHex: string;
  difficulty: Difficulty;
  currentLevel: number;
  currentQuestionIndex: number;
  score: number;
  levelsCompleted: number;
  lastPlayedAt: string;
  totalLevels: number;
}

export interface AdminPlayerDetail extends AdminPlayerSummary {
  rewardProfiles: RewardProfile[];
  progressItems: AdminPlayerProgressItem[];
  totalAnswers: number;
  correctAnswers: number;
}

export interface UploadAssetResponse {
  url: string;
  path: string;
  bucket: string;
}

export interface CategoryFormValues {
  title: string;
  iconUrl: string;
  difficulty: Difficulty;
  colorHex: string;
  isRewardBased: boolean;
  isActive: boolean;
  description: string;
  mapBackgroundUrl: string;
  levelPodiumUrl: string;
}

export interface LevelFormValues {
  title: string;
  numberOfLevels?: number;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitSeconds: number;
  pointsPerCorrect: number;
  isActive: boolean;
}

export interface QuestionFormValues {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionKey;
  explanation: string;
  translations: Record<string, Partial<QuestionTranslation>>;
  mediaUrl: string;
  isActive: boolean;
}
