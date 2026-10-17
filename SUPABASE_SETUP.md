# Supabase + Admin Setup

This app uses Supabase as the real source of truth for players, gameplay progress, admin content, leaderboard data, messages, and uploaded admin images.

## 1. Create The Supabase Project

1. Create a new Supabase project.
2. Open Supabase SQL Editor.
3. Run the migrations in `supabase/migrations` in order.
4. Keep the project URL, anon key, and service role key ready.

## 2. Add Environment Variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_ACCESS_CODE=choose-a-private-admin-code
NEXT_PUBLIC_APP_URL=http://localhost:3000
CHAPA_SECRET_KEY=your-chapa-secret-key
CHAPA_WEBHOOK_SECRET=choose-a-random-chapa-webhook-secret
```

Important: keep `SUPABASE_SERVICE_ROLE_KEY`, `CHAPA_SECRET_KEY`, and `CHAPA_WEBHOOK_SECRET` private. They are used only by server API routes. Never use a `CHAPUBK...` public key as `CHAPA_SECRET_KEY`.

Optional:

```bash
SUPABASE_STORAGE_BUCKET=trivia-assets
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=houseofchewataBot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=choose-a-private-webhook-secret
```

If you leave it out, the app uses `trivia-assets` by default and creates the bucket on first admin upload.

For Telegram phone collection, run all migrations including `012_telegram_user_profiles.sql`, then point your bot webhook to:

```text
https://your-domain.com/api/game/telegram-contact
```

When setting the webhook, pass the same `TELEGRAM_WEBHOOK_SECRET` as Telegram's `secret_token`. The Mini App can only request contact permission; the phone number itself is delivered to the bot webhook and saved in Supabase for the game login sync to read.

## 3. Configure Chapa Payments

1. Run all migrations, including `015_chapa_donations.sql`.
2. In Chapa Dashboard, switch to the mode you want to use and copy its **secret** key into `CHAPA_SECRET_KEY`. Test keys contain `TEST`; the production deployment must use the live secret key.
3. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin, with no path or trailing slash, for example `https://game.example.com`.
4. In Chapa Dashboard -> Settings -> Webhooks, add:

   ```text
   https://game.example.com/api/game/donations/webhook
   ```

5. Choose Chapa Signature authentication and enter the exact same random secret stored in `CHAPA_WEBHOOK_SECRET`.

The app supplies these per-payment URLs automatically:

- Callback: `https://game.example.com/api/game/donations/callback`
- Customer return page: `https://game.example.com/tip/thank-you`

For a production smoke test, use the minimum 10 ETB tip, complete it with a real payment method, confirm the thank-you page says the payment was received, and confirm the matching row in `public.donation_transactions` has `status = 'success'` and `mode = 'live'`.

## 4. Run The App

```bash
npm install
npm run dev
```

Open:

- Player game: `http://localhost:3000`
- Admin control panel: `http://localhost:3000/admin`

When `ADMIN_ACCESS_CODE` is set, `/admin/login` asks for that code. If it is empty, local dev mode lets you enter without a code.

## 5. Control Game Data From Admin

Use these admin pages:

- `/admin/categories`: create and edit categories, use the color sampler, and upload icons/backgrounds/podiums directly from your device.
- `/admin/categories/[categoryId]/levels`: create levels, timers, unlock rules, and rewards.
- `/admin/categories/[categoryId]/levels/[levelId]/questions`: add questions manually, upload question images, edit existing questions, or import many questions.
- `/admin/import`: choose a category, upload `.txt` or `.docx`, preview extracted questions, then import them across easy, medium, and hard levels automatically.

The game reads live content from `/api/game/content`, and gameplay writes real players, score events, progress, reward profiles, and message data back to Supabase.

## 6. Question Import Format

The importer accepts `.txt` and `.docx`. Best format:

```text
Q: Water freezes at what temperature in Celsius?
A: 0
B: 12
C: 24
D: 100
Answer: A
Difficulty: Easy
Explanation: Water freezes at 0 degrees Celsius.
```

It also accepts simple pipe-separated rows:

```text
Water freezes at what temperature?|0|12|24|100|A|Easy|Water freezes at 0 degrees Celsius.
```

Before category import, make sure the category has active levels with difficulty set to Easy, Medium, and Hard. The default 20-level plan is levels 1-5 easy, 6-15 medium, and 16-20 hard, with 5 questions per level. A reusable template is available at `/question-import-template.txt`.

## 7. Asset Uploads

Admin image fields support drag-and-drop uploads and regular device file selection:

- Category icon
- Category map background
- Category level podium image
- Question image

Uploads are stored in the Supabase bucket configured above. You can still paste external public URLs if you want.

The map starts from the bottom and scrolls upward, so tall background art should be designed vertically.

## 8. Production Checklist

- Set `ADMIN_ACCESS_CODE` to a strong private value.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
- Run `npm run build` before deploy.
- Confirm the `trivia-assets` bucket exists or let the first admin upload create it automatically.
- Confirm admin routes require login by opening `/admin` and `/api/admin/categories` in a private browser.
- Set `NEXT_PUBLIC_APP_URL` to your production domain after deployment.
- Use the live Chapa secret key in production; do not expose it through a `NEXT_PUBLIC_...` variable.
- Configure the Chapa webhook URL and matching `CHAPA_WEBHOOK_SECRET`.
- Complete one 10 ETB live payment and verify its database row before advertising the tip feature.
