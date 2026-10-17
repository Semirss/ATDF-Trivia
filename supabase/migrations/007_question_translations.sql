alter table public.questions
  add column if not exists translations jsonb not null default '{}'::jsonb;

create index if not exists questions_translations_gin_idx
  on public.questions using gin (translations);
