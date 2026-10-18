alter table public.style_profiles
  add column if not exists preference_state jsonb not null default '{}'::jsonb;