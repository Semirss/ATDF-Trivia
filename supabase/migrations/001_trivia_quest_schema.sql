create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists reward_profiles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  telegram_username text not null default '',
  created_at timestamptz default now(),
  unique(player_id)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  icon_url text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  is_reward_based boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  color_hex text not null default '#f2b84b',
  description text not null default '',
  map_background_url text not null default '',
  level_podium_url text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists category_levels (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  level_number int not null,
  title text not null,
  difficulty text not null default 'easy' check (difficulty in ('easy','medium','hard')),
  question_count int not null default 5,
  time_limit_seconds int not null default 30,
  points_per_correct int not null default 10,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(category_id, level_number)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references category_levels(id) on delete cascade,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  explanation text,
  media_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists player_progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  current_level int not null default 1,
  current_question_index int not null default 0,
  score int not null default 0,
  levels_completed int not null default 0,
  last_played_at timestamptz default now(),
  unique(player_id, category_id)
);

create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  category_id uuid not null references categories(id),
  level_id uuid not null references category_levels(id),
  question_id uuid not null references questions(id),
  is_correct boolean not null,
  points int not null default 0,
  answered_at timestamptz default now()
);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  category_id uuid not null references categories(id),
  reward_type text not null,
  reward_value text not null,
  status text not null default 'pending' check (status in ('pending','claimed','expired')),
  earned_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  text text not null,
  reply_to_message_id uuid references messages(id) on delete set null,
  posted_at timestamptz default now()
);

create table if not exists admin_users (
  id uuid primary key references auth.users(id),
  email text not null unique,
  created_at timestamptz default now()
);

create table if not exists game_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into game_config (key, value)
values
  ('max_streak_bonus', '{"multiplier": 2, "trigger_at": 3}'),
  ('default_time_limit_seconds', '30'),
  ('leaderboard_display_count', '100')
on conflict (key) do nothing;

drop view if exists leaderboard;

create view leaderboard as
with active_level_totals as (
  select coalesce(sum(cl.question_count), 0)::int as total_questions
  from category_levels cl
  join categories c on c.id = cl.category_id
  where cl.is_active = true and c.is_active = true
),
answer_counts as (
  select player_id, count(*)::int as questions_answered
  from score_events
  group by player_id
),
progress_totals as (
  select
    player_id,
    coalesce(sum(score), 0)::int as total_score,
    count(distinct case when score > 0 or levels_completed > 0 then category_id end)::int as categories_played,
    coalesce(max(current_level), 1)::int as current_level_reached
  from player_progress
  group by player_id
)
select
  p.id as player_id,
  p.name,
  p.avatar_url,
  coalesce(pt.total_score, 0) as total_score,
  coalesce(pt.categories_played, 0) as categories_played,
  rank() over (order by coalesce(pt.total_score, 0) desc) as global_rank,
  case
    when alt.total_questions > 0
      then least(100, round((coalesce(ac.questions_answered, 0)::numeric / alt.total_questions) * 100)::int)
    else 0
  end as completion_percent,
  coalesce(ac.questions_answered, 0) as questions_answered,
  coalesce(alt.total_questions, 0) as total_questions,
  coalesce(pt.current_level_reached, 1) as current_level_reached
from players p
left join progress_totals pt on pt.player_id = p.id
left join answer_counts ac on ac.player_id = p.id
cross join active_level_totals alt;

alter table players enable row level security;
alter table reward_profiles enable row level security;
alter table categories enable row level security;
alter table category_levels enable row level security;
alter table questions enable row level security;
alter table player_progress enable row level security;
alter table score_events enable row level security;
alter table rewards enable row level security;
alter table messages enable row level security;
alter table admin_users enable row level security;
alter table game_config enable row level security;

drop policy if exists "public active categories" on categories;
create policy "public active categories" on categories for select using (is_active = true);

drop policy if exists "public active levels" on category_levels;
create policy "public active levels" on category_levels for select using (is_active = true);

drop policy if exists "public active questions" on questions;
create policy "public active questions" on questions for select using (is_active = true);

drop policy if exists "players own profile" on players;
create policy "players own profile" on players for all using (id::text = auth.uid()::text) with check (id::text = auth.uid()::text);

drop policy if exists "players own rewards profile" on reward_profiles;
create policy "players own rewards profile" on reward_profiles for all using (player_id::text = auth.uid()::text) with check (player_id::text = auth.uid()::text);

drop policy if exists "players own progress" on player_progress;
create policy "players own progress" on player_progress for all using (player_id::text = auth.uid()::text) with check (player_id::text = auth.uid()::text);

drop policy if exists "players own score events" on score_events;
create policy "players own score events" on score_events for insert with check (player_id::text = auth.uid()::text);

drop policy if exists "players read own score events" on score_events;
create policy "players read own score events" on score_events for select using (player_id::text = auth.uid()::text);

drop policy if exists "players own rewards" on rewards;
create policy "players own rewards" on rewards for select using (player_id::text = auth.uid()::text);

drop policy if exists "players message board read" on messages;
create policy "players message board read" on messages for select using (true);

drop policy if exists "players message board post" on messages;
create policy "players message board post" on messages for insert with check (player_id::text = auth.uid()::text);
