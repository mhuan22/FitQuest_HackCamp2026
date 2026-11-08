-- Expand the existing validator without discarding XP or invalidating legacy
-- rows. Legacy XP is converted once by normalizeSave when the client loads it.
create or replace function public.valid_player_progress(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare field text; training_date text;
begin
  if jsonb_typeof(value) is distinct from 'object' or
     not (value ?& array['strengthXp','agilityXp','defenseXp','healthXp','sound','rewards']) or
     (value - array['strengthXp','agilityXp','defenseXp','healthXp','skin','sound','rewards','version','streak','lastTrainingDate']) <> '{}'::jsonb then
    return false;
  end if;
  foreach field in array array['strengthXp','agilityXp','defenseXp','healthXp'] loop
    if jsonb_typeof(value -> field) is distinct from 'number' or
       (value ->> field)::numeric <> trunc((value ->> field)::numeric) or
       (value ->> field)::numeric < 0 or (value ->> field)::numeric > 9007199254740991 then return false; end if;
  end loop;
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
  '{"version":2,"strengthXp":0,"agilityXp":0,"defenseXp":0,"healthXp":0,"streak":0,"lastTrainingDate":"","sound":true,"rewards":[]}'::jsonb;
-- Keep the existing authenticated RPC, row ownership policies, revisions and
-- idempotency keys. Its validator now accepts both old and current saves.
