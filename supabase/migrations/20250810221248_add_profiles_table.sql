-- Profiles table + policies + trigger

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz default now()
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

alter table public.profiles enable row level security;

-- Ensure RLS is on
alter table public.profiles enable row level security;

-- Policies (drop if already present, then create)
drop policy if exists "profiles: read for all" on public.profiles;
create policy "profiles: read for all"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles: user can insert own" on public.profiles;
create policy "profiles: user can insert own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: user can update own" on public.profiles;
create policy "profiles: user can update own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();