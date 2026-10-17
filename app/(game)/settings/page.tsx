"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Globe2, Palette } from "lucide-react";
import { PageTransition } from "@/components/ui/PageTransition";
import { supportedLanguages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/store/playerStore";

type VisualTheme = "classic" | "glacier" | "dark";

const themeChoices: Array<{ id: VisualTheme; label: string }> = [
  { id: "classic", label: "Default" },
  { id: "glacier", label: "Light" },
  { id: "dark", label: "Dark" }
];

function applyTheme(theme: VisualTheme) {
  document.documentElement.dataset.gameTheme = theme;
  window.localStorage.setItem("trivia-theme", theme);
}

export default function SettingsPage() {
  const router = useRouter();
  const language = usePlayerStore((state) => state.language);
  const setLanguage = usePlayerStore((state) => state.setLanguage);
  const [theme, setTheme] = useState<VisualTheme>("classic");

  useEffect(() => {
    const saved = window.localStorage.getItem("trivia-theme");
    const current: VisualTheme = saved === "dark" || saved === "glacier" ? saved : "classic";
    setTheme(current);
    applyTheme(current);
  }, []);

  return (
    <PageTransition>
      <div className="game-safe settings-safe">
        <button type="button" onClick={() => router.back()} className="settings-back" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <main className="settings-panel">
          <header>
            <small>App</small>
            <h1>Settings</h1>
            <span />
          </header>

          <section className="settings-section">
            <h2><Globe2 className="h-5 w-5" />Language</h2>
            <div className="settings-language-grid">
              {supportedLanguages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLanguage(item.code)}
                  className={cn("settings-language-choice", language === item.code && "is-active")}
                >
                  {language === item.code ? <Check className="h-5 w-5" /> : null}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-theme-section">
            <h2><Palette className="h-5 w-5 fill-current" />Themes</h2>
            <div className="settings-theme-grid">
              {themeChoices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTheme(item.id);
                    applyTheme(item.id);
                  }}
                  className={cn("settings-theme-choice", `theme-${item.id}`, theme === item.id && "is-active")}
                >
                  <span>{theme === item.id ? <Check className="h-4 w-4" /> : null}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <div className="settings-watermark" aria-hidden="true">
            <span>ATDF</span>
            <strong>2026</strong>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
