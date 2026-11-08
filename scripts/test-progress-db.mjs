// Real PostgreSQL (WASM), entirely in memory; never connects to hosted Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const sql = name => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  await db.exec(sql('migrations/202611080001_accounts_and_progress.sql'));
  const current = { version: 2, ultimateStacks: 1, strengthXp: 300, agilityXp: 100, defenseXp: 50, healthXp: 20, sound: false, rewards: ['Slime Band'], streak: 3, lastTrainingDate: '2026-11-08' };
  const valid = async value => (await db.query('select public.valid_player_progress($1::jsonb) as valid', [JSON.stringify(value)])).rows[0].valid;
  assert.equal(await valid(current), false, 'Old schema reproduces rejection of current saves');
  await db.exec(`insert into auth.users values ('33333333-3333-4333-8333-333333333333', 'legacy@example.test', '{"username":"LegacyPlayer"}');
    update public.player_progress set data = jsonb_set(data, '{strengthXp}', '300'), revision = 3,
      last_mutation_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';`);
  const before = (await db.query('select * from public.player_progress')).rows[0];
  await db.exec(sql('migrations/202611080002_progress_v2.sql'));
  await db.exec(sql('migrations/202611080003_ultimate_stacks.sql'));
  await db.exec(sql('migrations/202611080004_workout_sessions.sql'));
  const after = (await db.query('select * from public.player_progress')).rows[0];
  assert.deepEqual(after, before, 'Migration preserves existing data, revision and mutation identity');
  assert.equal(await valid(before.data), true, 'Legacy saves remain readable and valid');
  await db.exec("delete from auth.users where id = '33333333-3333-4333-8333-333333333333'");
  assert.equal(await valid(current), true);
  for (const invalid of [
    { ...current, version: null }, { ...current, version: 3 },
    { ...current, strengthXp: -1 }, { ...current, strengthXp: 1.5 },
    { ...current, healthXp: 9007199254740992 },
    { ...current, ultimateStacks: -1 }, { ...current, ultimateStacks: 4 },
    { ...current, ultimateStacks: 1.5 }, { ...current, ultimateStacks: null },
    { ...current, streak: -1 }, { ...current, streak: 1.5 },
    { ...current, lastTrainingDate: '2026-02-31' },
    { ...current, lastTrainingDate: '', streak: 1 },
    { ...current, rewards: ['Unknown reward'] }, { ...current, secret: true },
  ]) assert.equal(await valid(invalid), false, `Invalid data rejected: ${JSON.stringify(invalid)}`);
  await db.exec(sql('tests/accounts.sql'));
  await db.exec(`
    insert into auth.users values ('44444444-4444-4444-8444-444444444444', 'current@example.test', '{"username":"CurrentPlayer"}');
    set role authenticated;
    select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', false);
  `);
  const save = async (revision, id) => (await db.query('select public.save_player_progress($1::jsonb, $2::bigint, $3::uuid) as revision', [JSON.stringify(current), revision, id])).rows[0].revision;
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(Number(await save(0, id)), 1);
  assert.equal(Number(await save(0, id)), 1, 'Retry returns the same revision');
  const restored = (await db.query('select data from public.player_progress')).rows[0].data;
  assert.deepEqual(restored, current, 'XP, streak, training date, rewards and preferences survive save/load');
  await assert.rejects(save(0, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), error => error.code === '40001');
  const spent = { ...current, ultimateStacks: 0 };
  await db.query('select public.save_player_progress($1::jsonb, 1, $2::uuid)', [JSON.stringify(spent), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd']);
  const oldClient = { ...current }; delete oldClient.ultimateStacks;
  await db.query('select public.save_player_progress($1::jsonb, 2, $2::uuid)', [JSON.stringify(oldClient), 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']);
  assert.equal((await db.query('select data from public.player_progress')).rows[0].data.ultimateStacks, 0, 'Older clients do not restore or erase spent stacks');

  const playerId = '44444444-4444-4444-8444-444444444444';
  const workoutId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const record = (id, player, xp) => db.query("select public.record_workout($1, $2, 'curls', 5, null, $3)", [id, player, xp]);
  await record(workoutId, playerId, 50);
  await record(workoutId, playerId, 50);
  await assert.rejects(record(workoutId, '55555555-5555-4555-8555-555555555555', 50), error => error.code === '42501');
  await assert.rejects(record(id, playerId, 500), error => error.code === '23514');
  await assert.rejects(db.query('select * from fitquest_reporting.workout_xp'), error => error.code === '42501');
  await db.exec(`
    reset role;
    create role fitquest_reporting_reader nologin;
    grant usage on schema fitquest_reporting to fitquest_reporting_reader;
    grant select on fitquest_reporting.workout_xp to fitquest_reporting_reader;
    set role fitquest_reporting_reader;
  `);
  const workouts = (await db.query('select player_key, station, xp from fitquest_reporting.workout_xp')).rows;
  assert.deepEqual(workouts, [{ player_key: playerId, station: 'curls', xp: 50 }], 'Report reader sees the completed workout once');
  await assert.rejects(db.query('select * from public.workout_sessions'), error => error.code === '42501');

  console.log('Database checks passed: reproduced/fixed schema mismatch, preserved legacy progress, validated current fields, ownership, save/load, idempotent retries, revision conflicts, and private, retry-safe workout reporting.');
} finally { await db.close(); }
