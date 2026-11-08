create table public.workout_sessions (
  id uuid primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  station text not null check (station in ('curls', 'squats', 'situps', 'treadmill')),
  reps integer,
  active_seconds integer,
  xp integer not null check (xp > 0),
  completed_at timestamptz not null default now(),
  check (
    (station = 'treadmill' and reps is null and active_seconds is not null
      and active_seconds >= 3 and xp <= active_seconds / 3)
    or (station <> 'treadmill' and active_seconds is null and reps is not null
      and reps > 0 and xp = reps::bigint * 10)
  )
);

create index workout_sessions_completed_at_idx on public.workout_sessions (completed_at);
alter table public.workout_sessions enable row level security;
revoke all on public.workout_sessions from public, anon, authenticated;

create function public.record_workout(
  session_id uuid, expected_player uuid, station_key text, rep_count integer, run_seconds integer, earned_xp integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  player uuid := auth.uid();
begin
  if player is null or player is distinct from expected_player then
    raise exception 'Sign in to record a workout' using errcode = '42501';
  end if;
  insert into public.workout_sessions (id, player_id, station, reps, active_seconds, xp)
    values (session_id, player, station_key, rep_count, run_seconds, earned_xp)
    on conflict (id) do nothing;
end;
$$;

revoke all on function public.record_workout(uuid, uuid, text, integer, integer, integer) from public, anon;
grant execute on function public.record_workout(uuid, uuid, text, integer, integer, integer) to authenticated;

-- Grant the Databricks connection role access to this view during deployment.
-- Cast UUIDs in PostgreSQL so the foreign catalog only sees supported types.
create schema fitquest_reporting;
revoke all on schema fitquest_reporting from public, anon, authenticated;
create view fitquest_reporting.workout_xp as
  select player_id::text as player_key, station, xp, completed_at
  from public.workout_sessions;
revoke all on fitquest_reporting.workout_xp from public, anon, authenticated;
