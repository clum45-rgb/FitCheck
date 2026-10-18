create table if not exists user_carts (
  user_id    uuid primary key,
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No policies defined on purpose: only the service_role key (used by this
-- backend only) can bypass RLS. The anon/authenticated roles get default-deny.
alter table user_carts enable row level security;
