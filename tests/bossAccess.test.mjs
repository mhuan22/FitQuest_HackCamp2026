import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL(`../src/game/${name}.ts`, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const progressionUrl = data(compile('progression'));
const p = await import(progressionUrl);
const access = await import(data(compile('bossAccess').replace('"./progression"', JSON.stringify(progressionUrl))));
test('boss entry requires both the character level and previous clear', () => {
 const fresh=p.normalizeSave(null);
 assert.equal(access.bossLockReason(fresh,'slime'),'');
 for (const boss of ['golem','owl','shellback']) {
  const requirement=access.BOSS_REQUIREMENTS[boss];
  assert.match(access.bossLockReason(fresh,boss), /Character Level/);
  const leveled=access.raiseDemoLevel(fresh,requirement.level);
  assert.match(access.bossLockReason(leveled,boss), /Defeat/);
  assert.match(access.bossLockReason({...fresh,rewards:[requirement.reward]},boss), /Character Level/);
  assert.equal(access.bossLockReason({...leveled,rewards:[requirement.reward]},boss),'');
 }
});
test('demo level shortcut grants actual XP without dropping existing levels or rewards', () => {
 const fresh=p.normalizeSave(null);
 const leveled=access.raiseDemoLevel(fresh,7);
 assert.equal(p.characterLevel(leveled),7);
 assert.equal(p.characterLevel(fresh),1);
 assert.equal(leveled.ultimateStacks,fresh.ultimateStacks);
 assert.equal(p.characterLevel(access.raiseDemoLevel(leveled,3)),7);
 assert.deepEqual(leveled.rewards,[]);
 assert.equal(access.raiseDemoLevel(fresh,Infinity),fresh);
});
test('demo boss shortcut grants prerequisite clears and level without clearing target boss', () => {
 const fresh=p.normalizeSave(null);
 const unlocked=access.unlockDemoBoss(fresh,'shellback');
 assert.equal(p.characterLevel(unlocked),7);
 for(const boss of ['slime','golem','owl','shellback']) assert.equal(access.bossLockReason(unlocked,boss),'');
 assert.deepEqual(unlocked.rewards,['Slime Band','Golem Crest','Frost Feather']);
 assert.deepEqual(access.unlockDemoBoss(unlocked,'shellback').rewards,unlocked.rewards);
 assert.deepEqual(fresh.rewards,[]);
});
