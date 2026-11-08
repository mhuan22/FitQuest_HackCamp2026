-- Run once in a new project, or apply with `supabase db push`.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  normalized_username text generated always as (lower(username)) stored unique
);

create function public.valid_player_progress(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text;
begin
  if jsonb_typeof(value) is distinct from 'object' or
     not (value ?& array['strengthXp','agilityXp','defenseXp','healthXp','skin','sound','rewards']) or
     (value - array['strengthXp','agilityXp','defenseXp','healthXp','skin','sound','rewards']) <> '{}'::jsonb then
    return false;
  end if;
  foreach field in array array['strengthXp','agilityXp','defenseXp','healthXp','skin'] loop
    if jsonb_typeof(value -> field) is distinct from 'number' or
       (value ->> field)::numeric <> trunc((value ->> field)::numeric) or
       (value ->> field)::numeric < 0 or (value ->> field)::numeric > 2147483647 then return false; end if;
  end loop;
  if (value ->> 'skin')::int > 5 or jsonb_typeof(value -> 'sound') is distinct from 'boolean' or
     jsonb_typeof(value -> 'rewards') is distinct from 'array' then return false; end if;
  if exists (select 1 from jsonb_array_elements(value -> 'rewards') item
             where jsonb_typeof(item) <> 'string' or item #>> '{}' not in ('Slime Band','Golem Crest','Frost Feather','Mire Crown')) then
    return false;
  end if;
  return jsonb_array_length(value -> 'rewards') <= 4;
exception when others then return false;
end;
$$;

create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"strengthXp":0,"agilityXp":0,"defenseXp":0,"healthXp":0,"skin":0,"sound":true,"rewards":[]}'::jsonb
    check (public.valid_player_progress(data)),
  revision bigint not null default 0 check (revision >= 0),
  last_mutation_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
revoke all on public.profiles, public.player_progress from public, anon, authenticated;
grant select on public.profiles, public.player_progress to authenticated;
grant all on public.profiles, public.player_progress to service_role;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own progress" on public.player_progress for select to authenticated using ((select auth.uid()) = user_id);

create function public.initialize_player()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, username) values (new.id, trim(new.raw_user_meta_data ->> 'username'));
  insert into public.player_progress(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.initialize_player() from public, anon, authenticated;
create trigger initialize_player after insert on auth.users for each row execute function public.initialize_player();

-- Compare-and-swap prevents lost updates. The mutation UUID makes an ambiguous
-- network failure retryable without applying the same save twice.
create function public.save_player_progress(p_data jsonb, p_revision bigint, p_mutation_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare saved public.player_progress;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into saved from public.player_progress where user_id = auth.uid() for update;
  if not found then raise exception 'Player save missing'; end if;
  if p_mutation_id is null or p_revision is null or not public.valid_player_progress(p_data) then
    raise exception 'Invalid progress' using errcode = '22023';
  end if;
  if saved.last_mutation_id = p_mutation_id and saved.data = p_data then return saved.revision; end if;
  if saved.revision <> p_revision then
    raise exception 'Save conflict' using errcode = '40001';
  end if;
  update public.player_progress set data = p_data, revision = revision + 1,
    last_mutation_id = p_mutation_id, updated_at = now() where user_id = auth.uid()
    returning revision into saved.revision;
  return saved.revision;
end;
$$;
revoke all on function public.save_player_progress(jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_player_progress(jsonb, bigint, uuid) to authenticated;

-- Persistent throttling works across Edge Function instances, including attempts
-- for usernames that do not exist. Only the server can access these buckets.
create table public.login_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table public.login_rate_limits enable row level security;
revoke all on public.login_rate_limits from public, anon, authenticated;
grant all on public.login_rate_limits to service_role;

create function public.consume_login_attempt(p_username text, p_ip text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_time timestamptz := clock_timestamp(); name_count integer; ip_count integer;
begin
  delete from public.login_rate_limits where window_start < attempt_time - interval '1 day';
  insert into public.login_rate_limits as limits values ('name:' || md5(p_username), attempt_time, 1)
  on conflict (bucket) do update set
    attempts = case when limits.window_start < attempt_time - interval '15 minutes' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < attempt_time - interval '15 minutes' then attempt_time else limits.window_start end
  returning attempts into name_count;
  insert into public.login_rate_limits as limits values ('ip:' || md5(p_ip), attempt_time, 1)
  on conflict (bucket) do update set
    attempts = case when limits.window_start < attempt_time - interval '15 minutes' then 1 else limits.attempts + 1 end,
    window_start = case when limits.window_start < attempt_time - interval '15 minutes' then attempt_time else limits.window_start end
  returning attempts into ip_count;
  return name_count <= 10 and ip_count <= 60;
end;
$$;
revoke all on function public.consume_login_attempt(text, text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text, text) to service_role;
