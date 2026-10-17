insert into game_config (key, value)
values (
  'youtube_ad_config',
  '{"enabled": false, "url": "", "urls": [], "duration_seconds": 15, "aspect_ratio": "normal", "level_interval": 2, "selection_mode": "rotate", "trigger_mode": "interval", "target_levels": []}'::jsonb
)
on conflict (key) do nothing;
