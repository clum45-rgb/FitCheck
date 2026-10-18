alter table public.style_profiles
  alter column aesthetic type text[]
  using case
    when aesthetic is null then null
    else array[aesthetic]
  end;

alter table public.style_profiles
  add column colors text[] not null default '{}',
  add column silhouettes text[] not null default '{}',
  add column materials text[] not null default '{}',
  add column categories text[] not null default '{}';
