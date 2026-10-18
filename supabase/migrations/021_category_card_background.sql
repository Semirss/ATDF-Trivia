-- Give home category cards their own artwork instead of reusing the tall level-map image.
alter table public.categories
  add column if not exists card_background_url text not null default '';
