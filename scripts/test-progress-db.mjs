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
  const current = { version: 2, strengthXp: 300, agilityXp: 100, defenseXp: 50, healthXp: 20, sound: false, rewards: ['Slime Band'], streak: 3, lastTrainingDate: '2026-11-08' };
  const valid = async value => (await db.query('select public.valid_player_progress($1::jsonb) as valid', [JSON.stringify(value)])).rows[0].valid;
  assert.equal(await valid(current), false, 'Old schema reproduces rejection of current saves');
  await db.exec(`insert into auth.users values ('33333333-3333-4333-8333-333333333333', 'legacy@example.test', '{"username":"LegacyPlayer"}');
    update public.player_progress set data = jsonb_set(data, '{strengthXp}', '300'), revision = 3,
      last_mutation_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';`);
  const before = (await db.query('select * from public.player_progress')).rows[0];
  await db.exec(sql('migrations/202611080002_progress_v2.sql'));
  const after = (await db.query('select * from public.player_progress')).rows[0];
  assert.deepEqual(after, before, 'Migration preserves existing data, revision and mutation identity');
  assert.equal(await valid(before.data), true, 'Legacy saves remain readable and valid');
  await db.exec("delete from auth.users where id = '33333333-3333-4333-8333-333333333333'");
  assert.equal(await valid(current), true);
  for (const invalid of [
    { ...current, version: null }, { ...current, version: 3 },
    { ...current, strengthXp: -1 }, { ...current, strengthXp: 1.5 },
    { ...current, healthXp: 9007199254740992 },
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
  console.log('Database checks passed: reproduced/fixed schema mismatch, preserved legacy progress, validated current fields, ownership, save/load, idempotent retries and revision conflicts.');
} finally { await db.close(); }
