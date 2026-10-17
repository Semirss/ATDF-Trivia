# Trivia Quest

Trivia Quest is a Next.js 14 App Router game with a player-facing animated trivia experience and an admin dashboard that controls categories, level difficulty, question counts, category-wide question imports, messages, rewards, uploads, and config through Supabase.

The app now expects real Supabase data instead of bundled mock content. Player onboarding, gameplay progress, leaderboard rows, admin stats, messages, and admin asset uploads all flow through the live database and storage bucket.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase

See `SUPABASE_SETUP.md` for the full live database, admin access-code, and question-import setup.

## Important Routes

- `/` player category galaxy
- `/onboarding` player setup
- `/category/[categoryId]` level map
- `/category/[categoryId]/play` gameplay
- `/leaderboard`, `/messages`, `/profile`
- `/admin` admin dashboard
- `/admin/categories`
- `/admin/categories/[id]/levels`
- `/admin/categories/[id]/levels/[levelId]/questions`
