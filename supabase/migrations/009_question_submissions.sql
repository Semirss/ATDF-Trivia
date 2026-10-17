create table if not exists question_submissions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete set null,
  player_name text not null default '',
  question_text text not null,
  source text not null default 'home_robot',
  created_at timestamptz default now()
);

create index if not exists question_submissions_player_id_idx on question_submissions(player_id);
create index if not exists question_submissions_created_at_idx on question_submissions(created_at desc);

alter table question_submissions enable row level security;

drop policy if exists "question submissions can be created" on question_submissions;
create policy "question submissions can be created" on question_submissions
  for insert
  with check (true);
