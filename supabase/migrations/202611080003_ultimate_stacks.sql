-- Add persistent Ultimate stacks. Existing rows and revisions stay intact;
-- legacy saves receive their starter/historical stacks when loaded or saved.
create or replace function public.valid_player_progress(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; training_date text;
begin
  if jsonb_typeof(value) is distinct from 'object' or
     not (value ?& array['strengthXp','agilityXp','defenseXp','healthXp','sound','rewards']) or
     (value - array['strengthXp','agilityXp','defenseXp','healthXp','skin','sound','rewards','version','streak','lastTrainingDate','ultimateStacks']) <> '{}'::jsonb then
    return false;
  end if;
  foreach field in array array['strengthXp','agilityXp','defenseXp','healthXp'] loop
    if jsonb_typeof(value -> field) is distinct from 'number' or
       (value ->> field)::numeric <> trunc((value ->> field)::numeric) or
       (value ->> field)::numeric < 0 or (value ->> field)::numeric > 9007199254740991 then return false; end if;
  end loop;
  if value ? 'ultimateStacks' then
    if jsonb_typeof(value -> 'ultimateStacks') is distinct from 'number' or
       (value ->> 'ultimateStacks')::numeric not between 0 and 3 or
       (value ->> 'ultimateStacks')::numeric <> trunc((value ->> 'ultimateStacks')::numeric) then return false; end if;
  end if;
  if value ? 'skin' then
    if jsonb_typeof(value -> 'skin') is distinct from 'number' or
       (value ->> 'skin')::numeric not between 0 and 5 or
       (value ->> 'skin')::numeric <> trunc((value ->> 'skin')::numeric) then return false; end if;
  end if;
  if value ? 'version' then
    if value -> 'version' <> '2'::jsonb or not (value ?& array['streak','lastTrainingDate']) or
       jsonb_typeof(value -> 'streak') is distinct from 'number' or
       (value ->> 'streak')::numeric <> trunc((value ->> 'streak')::numeric) or
       (value ->> 'streak')::numeric not between 0 and 9007199254740991 or
       jsonb_typeof(value -> 'lastTrainingDate') is distinct from 'string' then return false; end if;
    training_date := value ->> 'lastTrainingDate';
    if training_date <> '' then
      if training_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
         to_char(training_date::date, 'YYYY-MM-DD') <> training_date then return false; end if;
    elsif (value ->> 'streak')::numeric <> 0 then return false;
    end if;
  elsif value ? 'streak' or value ? 'lastTrainingDate' then
    return false;
  end if;
  if jsonb_typeof(value -> 'sound') is distinct from 'boolean' or
     jsonb_typeof(value -> 'rewards') is distinct from 'array' then return false; end if;
  if exists (select 1 from jsonb_array_elements(value -> 'rewards') item
             where jsonb_typeof(item) <> 'string' or item #>> '{}' not in ('Slime Band','Golem Crest','Frost Feather','Mire Crown')) then
    return false;
  end if;
  return jsonb_array_length(value -> 'rewards') <= 4;
exception when others then return false;
end;
$$;

alter table public.player_progress alter column data set default
  '{"version":2,"strengthXp":0,"agilityXp":0,"defenseXp":0,"healthXp":0,"streak":0,"lastTrainingDate":"","ultimateStacks":1,"sound":true,"rewards":[]}'::jsonb;

create or replace function public.save_player_progress(p_data jsonb, p_revision bigint, p_mutation_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare saved public.player_progress;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  select * into saved from public.player_progress where user_id = auth.uid() for update;
  if not found then raise exception 'Player save missing'; end if;
  -- Older clients must not erase a player's stored stacks when saving XP.
  if jsonb_typeof(p_data) = 'object' and not (p_data ? 'ultimateStacks') then
    p_data := p_data || jsonb_build_object('ultimateStacks', coalesce(
      (saved.data ->> 'ultimateStacks')::int,
      least(3, 1 + floor(coalesce((saved.data ->> 'streak')::numeric, 0) / 3))::int
    ));
  end if;
  if p_mutation_id is null or p_revision is null or not public.valid_player_progress(p_data) then
    raise exception 'Invalid progress' using errcode = '22023';
  end if;
  if saved.last_mutation_id = p_mutation_id and saved.data = p_data then return saved.revision; end if;
  if saved.revision <> p_revision then raise exception 'Save conflict' using errcode = '40001'; end if;
  update public.player_progress set data = p_data, revision = revision + 1,
    last_mutation_id = p_mutation_id, updated_at = now() where user_id = auth.uid()
    returning revision into saved.revision;
  return saved.revision;
end;
$$;
revoke all on function public.save_player_progress(jsonb, bigint, uuid) from public, anon;
grant execute on function public.save_player_progress(jsonb, bigint, uuid) to authenticated;
