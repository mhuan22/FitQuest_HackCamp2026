-- Run only in a disposable local database. scripts/test-database.mjs supplies
-- the small auth schema stub; these assertions exercise the production SQL.
begin;
insert into auth.users(id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111','a@example.test','{"username":"PlayerOne"}'),
  ('22222222-2222-4222-8222-222222222222','b@example.test','{"username":"PlayerTwo"}');
do $$ begin
  if (select count(*) from public.player_progress) <> 2 then raise exception 'Missing initial saves'; end if;
  begin
    insert into auth.users values ('33333333-3333-4333-8333-333333333333','c@example.test','{"username":"playerONE"}');
    raise exception 'Duplicate username accepted';
  exception when unique_violation then null; end;
  begin
    insert into auth.users values ('33333333-3333-4333-8333-333333333333','c@example.test','{"username":"bad name"}');
    raise exception 'Invalid username accepted';
  exception when check_violation then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare progress jsonb; version bigint; begin
  if (select count(*) from public.profiles) <> 1 or (select count(*) from public.player_progress) <> 1 then raise exception 'Ownership policy failed'; end if;
  if exists (select 1 from public.player_progress where user_id = '22222222-2222-4222-8222-222222222222') then raise exception 'Other account visible'; end if;
  select data into progress from public.player_progress;
  if (progress ->> 'strengthXp')::int <> 0 then raise exception 'Incorrect defaults'; end if;
  progress := jsonb_set(progress, '{strengthXp}', '50');
  version := public.save_player_progress(progress, 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if version <> 1 then raise exception 'Save failed'; end if;
  version := public.save_player_progress(progress, 0, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if version <> 1 then raise exception 'Retry incremented revision'; end if;
  begin
    perform public.save_player_progress(progress, 0, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Stale save accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_player_progress(jsonb_set(progress, '{strengthXp}', '-10'), 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Negative XP accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.save_player_progress(progress - 'rewards', 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'Missing field accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.player_progress set data = progress where user_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'Direct update allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.consume_login_attempt('someone','127.0.0.1');
    raise exception 'Client can manipulate rate limits';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if (select (data ->> 'strengthXp')::int from public.player_progress) <> 0 then raise exception 'Other player modified'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.profiles; raise exception 'Anonymous profile access'; exception when insufficient_privilege then null; end;
  begin perform public.save_player_progress('{}',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'); raise exception 'Anonymous save access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  for attempt in 1..10 loop
    if not public.consume_login_attempt('nonexistent','127.0.0.1') then raise exception 'Premature throttle'; end if;
  end loop;
  if public.consume_login_attempt('nonexistent','127.0.0.1') then raise exception 'Username throttle failed'; end if;
end $$;
reset role;
rollback;
