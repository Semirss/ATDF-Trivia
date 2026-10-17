insert into game_config (key, value)
values (
  'youtube_ad_config',
  '{"enabled": false, "url": "", "urls": [], "duration_seconds": 15, "aspect_ratio": "normal", "level_interval": 2, "selection_mode": "rotate", "trigger_mode": "interval", "target_levels": []}'::jsonb
)
on conflict (key) do update
set value =
  game_config.value
  || jsonb_build_object(
    'urls',
    case
      when jsonb_typeof(game_config.value->'urls') = 'array' then game_config.value->'urls'
      when coalesce(game_config.value->>'url', '') <> '' then jsonb_build_array(game_config.value->>'url')
      else '[]'::jsonb
    end
  )
  || jsonb_build_object(
    'selection_mode',
    coalesce(game_config.value->>'selection_mode', 'rotate'),
    'trigger_mode',
    coalesce(game_config.value->>'trigger_mode', 'interval'),
    'target_levels',
    case
      when jsonb_typeof(game_config.value->'target_levels') = 'array' then game_config.value->'target_levels'
      else '[]'::jsonb
    end
  );
