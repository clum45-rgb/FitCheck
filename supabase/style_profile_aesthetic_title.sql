alter table public.style_profiles
  alter column aesthetic drop default;

alter table public.style_profiles
  alter column aesthetic type text
  using array_to_string(aesthetic::text[], ' ');
