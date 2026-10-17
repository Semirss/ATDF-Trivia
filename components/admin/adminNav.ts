import {
  BarChart3,
  DatabaseZap,
  FileText,
  FolderKanban,
  Gauge,
  MessageSquare,
  SlidersHorizontal,
  Trophy,
  Users,
  type LucideIcon
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  hidden?: boolean;
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge, description: "Health, activity, and content performance" },
  { href: "/admin/analysis", label: "Analysis", icon: BarChart3, description: "Button taps, game starts, and completion trends" },
  { href: "/admin/categories", label: "Categories", icon: FolderKanban, description: "Categories, levels, and question structure" },
  { href: "/admin/import", label: "Import", icon: FileText, description: "Bulk question extraction and review queues" },
  { href: "/admin/players", label: "Players", icon: Users, description: "Player records, progress, and profiles" },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy, description: "Ranked player views and moderation" },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, description: "Chat moderation and player threads" },
  // Set hidden: false to make visible again later
  { href: "/admin/config", label: "Config", icon: SlidersHorizontal, description: "Scoring, timers, ads, and live game rules", hidden: true },
  { href: "/admin/database", label: "Database", icon: DatabaseZap, description: "Rotate and verify the live Supabase target", hidden: true }
];

export function resolveAdminNavItem(pathname: string) {
  return adminNavItems.find((item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))) ?? adminNavItems[0];
}
