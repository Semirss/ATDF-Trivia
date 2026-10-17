"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, LogOut } from "lucide-react";
import { adminNavItems } from "@/components/admin/adminNav";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/admin" && pathname.startsWith(href));
  }

  const brand = (
    <Link href="/" className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-900 text-white">
        <BarChart3 className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold text-lg text-gray-900">Trivia Quest</div>
      </div>
    </Link>
  );

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-black/8 bg-[rgba(247,245,240,0.92)] p-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">{brand}</div>
          <button
            type="button"
            onClick={logout}
            className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl border border-black/8 bg-white text-black shadow-sm"
            aria-label="Log out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {adminNavItems
            .filter((item) => !item.hidden)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-full border border-black/8 bg-white px-4 text-sm font-black text-black/62 shadow-sm",
                    isActive(item.href) && "border-black bg-black text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </div>

      <aside className="hidden md:flex md:min-h-dvh md:w-[260px] md:flex-col md:border-r md:border-gray-200 md:bg-gray-50/50 md:p-5">
        {brand}
        <nav className="mt-6 space-y-1">
          {adminNavItems
            .filter((item) => !item.hidden)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive(item.href)
                      ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                      : "text-gray-600 hover:bg-gray-100/50 hover:text-gray-900"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5", isActive(item.href) ? "text-gray-900" : "text-gray-500")} />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="mt-auto flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <LogOut className="h-4.5 w-4.5 text-gray-500" />
          Log out
        </button>
      </aside>
    </>
  );
}
