"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Search, Sparkles } from "lucide-react";
import { adminNavItems, resolveAdminNavItem } from "@/components/admin/adminNav";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [quickNav, setQuickNav] = useState("");
  const isLogin = pathname === "/admin/login";
  const activeNavItem = resolveAdminNavItem(pathname);

  if (isLogin) {
    return <main className="admin-shell-bg">{children}</main>;
  }

  function handleQuickNav(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = quickNav.trim().toLowerCase();
    const target = adminNavItems
      .filter((item) => !item.hidden)
      .find(
        (item) => item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
      );

    if (!target) {
      return;
    }

    router.push(target.href);
    setQuickNav("");
  }

  return (
    <main className="admin-shell-bg md:flex">
      <AdminSidebar />
      <section className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 xl:p-8">
        <div className="mx-auto max-w-[1700px]">
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-gray-100 bg-gray-50 text-gray-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-gray-900">{activeNavItem.label}</h1>
                  <p className="truncate text-sm text-gray-500">{activeNavItem.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <form
                  onSubmit={handleQuickNav}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 lg:min-w-[300px]"
                >
                  <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  <input
                    value={quickNav}
                    onChange={(event) => setQuickNav(event.target.value)}
                    placeholder="Search..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  />
                </form>

                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm">
                    <Bell className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-gray-900 text-sm font-semibold text-white">
                      A
                    </div>
                    <div className="min-w-0 pr-1">
                      <div className="truncate text-sm font-medium text-gray-900">Admin</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
