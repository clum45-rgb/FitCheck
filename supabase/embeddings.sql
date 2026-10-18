alter table public.scanned_products add column if not exists embedding jsonb;
alter table public.style_profiles add column if not exists embedding jsonb;
