import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        graphite: "#242628",
        cloud: "#edf0ee",
        ember: "#ff7a45",
        honey: "#f2b84b",
        mint: "#69d9b5",
        berry: "#e85d88",
        pool: "#56bdd7"
      },
      boxShadow: {
        engine: "0 18px 44px rgba(0,0,0,0.24)",
        bevel: "inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -7px 18px rgba(0,0,0,0.14)"
      },
      fontFamily: {
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"]
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        shine: {
          "0%": { transform: "translateX(-120%) rotate(12deg)" },
          "100%": { transform: "translateX(140%) rotate(12deg)" }
        },
        petals: {
          "0%": { transform: "translate3d(0,-12px,0) rotate(0deg)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translate3d(28px,72px,0) rotate(160deg)", opacity: "0" }
        },
        pulseRing: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.45" },
          "50%": { transform: "scale(1.16)", opacity: "0.1" }
        },
        gridSlide: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "42px 42px" }
        }
      },
      animation: {
        floaty: "floaty 4.8s ease-in-out infinite",
        shine: "shine 1.7s ease-in-out infinite",
        petals: "petals 7s linear infinite",
        pulseRing: "pulseRing 1.4s ease-in-out infinite",
        gridSlide: "gridSlide 14s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
