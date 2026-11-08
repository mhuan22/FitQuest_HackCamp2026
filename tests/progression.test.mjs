import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/game/progression.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const p = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('escalating levels carry overflow and show actual XP',()=>{
 for(const [xp,level] of [[0,1],[99,1],[100,2],[299,2],[300,3],[600,4]]) assert.equal(p.levelFromXp(xp),level);
 assert.deepEqual(p.xpProgress(120),{level:2,earned:20,required:200,percent:10});
});
test('legacy migration preserves levels and is idempotent',()=>{
 const save=p.normalizeSave({strengthXp:250,rewards:['Slime Band']});
 assert.equal(save.strengthXp,350); assert.equal(p.levelFromXp(save.strengthXp),3);
 assert.deepEqual(p.normalizeSave(save),save);
 assert.deepEqual(p.normalizeSave({rewards:null,strengthXp:-10}).rewards,[]);
 assert.equal(p.normalizeSave({strengthXp:Infinity}).strengthXp,0);
});
test('streak qualifies once daily and crosses year boundary',()=>{
 let save=p.normalizeSave(null);
 for(const date of ['2026-12-30','2026-12-31','2027-01-01']) save=p.trainingDay(save,new Date(date+'T12:00:00'));
 assert.equal(save.streak,3);
 assert.deepEqual(p.trainingDay(save,new Date('2027-01-01T15:00:00')),save);
 assert.equal(p.currentStreak(save,new Date('2027-01-03T12:00:00')),0);
 save=p.trainingDay(save,new Date('2027-01-03T12:00:00'));
 assert.equal(save.streak,1);
});
test('character level starts at one and counts balanced stat gains',()=>{
 assert.equal(p.characterLevel(p.DEFAULT_SAVE),1);
 assert.equal(p.characterLevel({...p.DEFAULT_SAVE,strengthXp:300,agilityXp:100}),3);
});

test('demo training-day clicks count streaks without granting levels', () => {
 let save=p.normalizeSave(null), date=new Date('2026-12-30T12:00:00');
 for(let click=1;click<=3;click++) {
  ({save,date}=p.nextDemoTrainingDay(save,date));
  assert.equal(p.currentStreak(save,date),click);
  assert.equal(save.ultimateStacks,1+Math.floor(click/3));
 }
 assert.equal(p.dateKey(date),'2027-01-02');
 // Skipping a calendar day breaks the streak.
 date.setDate(date.getDate()+2);
 ({save,date}=p.nextDemoTrainingDay(save,date));
 assert.equal(save.streak,1);

});

test('Ultimate starts with one stack at level one and consumes one per use', () => {
 const fresh=p.normalizeSave(null);
 assert.equal(p.characterLevel(fresh),1);
 assert.equal(fresh.ultimateStacks,1);
 const spent=p.consumeUltimate(fresh);
 assert.equal(spent.ultimateStacks,0);
 assert.equal(p.consumeUltimate(spent),spent);
 assert.equal(p.normalizeSave(spent).ultimateStacks,0);
});

test('Ultimate awards one stack per three consecutive training days, once per day, capped at three', () => {
 let save=p.normalizeSave(null);
 for(let day=1;day<=12;day++) {
  const date=new Date(2026,10,day,12);
  save=p.trainingDay(save,date);
  assert.equal(save.ultimateStacks,Math.min(3,1+Math.floor(day/3)));
  assert.deepEqual(p.trainingDay(save,date),save);
 }
 save=p.consumeUltimate(save);
 assert.equal(save.ultimateStacks,2);
 save=p.trainingDay(save,new Date(2026,10,13,12));
 assert.equal(save.ultimateStacks,2);
 save=p.trainingDay(save,new Date(2026,10,14,12));
 assert.equal(save.ultimateStacks,2);
 save=p.trainingDay(save,new Date(2026,10,15,12));
 assert.equal(save.ultimateStacks,3);
});

test('missing a day resets earning progress but keeps banked stacks', () => {
 let save=p.normalizeSave(null);
 save=p.trainingDay(save,new Date('2026-11-01T12:00:00'));
 save=p.trainingDay(save,new Date('2026-11-02T12:00:00'));
 save=p.trainingDay(save,new Date('2026-11-04T12:00:00'));
 assert.equal(save.streak,1); assert.equal(save.ultimateStacks,1);
 assert.equal(p.daysUntilUltimate(save,new Date('2026-11-04T12:00:00')),2);
 save=p.trainingDay(save,new Date('2026-11-05T12:00:00'));
 save=p.trainingDay(save,new Date('2026-11-06T12:00:00'));
 assert.equal(save.ultimateStacks,2);
 save=p.trainingDay(save,new Date('2026-11-08T12:00:00'));
 assert.equal(save.ultimateStacks,2);
});

test('legacy streaks grant historical stacks without regranting already spent stacks', () => {
 assert.equal(p.normalizeSave({version:2,streak:3,lastTrainingDate:'2026-11-08'}).ultimateStacks,2);
 assert.equal(p.normalizeSave({version:2,streak:6,lastTrainingDate:'2026-11-08'}).ultimateStacks,3);
 assert.equal(p.normalizeSave({version:2,streak:6,lastTrainingDate:'2026-11-08',ultimateStacks:0}).ultimateStacks,0);
 assert.equal(p.normalizeSave({ultimateStacks:50}).ultimateStacks,3);
 assert.equal(p.normalizeSave({ultimateStacks:-1}).ultimateStacks,0);
});

test('character XP tracks the nearest stat level without changing character level rules', () => {
 const save={...p.DEFAULT_SAVE,strengthXp:120,agilityXp:90};
 assert.equal(p.characterLevel(save),2);
 assert.deepEqual(p.characterXpProgress(save),{stat:'AGI',level:1,earned:90,required:100,percent:90});
 const leveled={...save,agilityXp:100};
 assert.equal(p.characterLevel(leveled),3);
 const next=p.characterXpProgress(leveled);
 assert.equal(next.stat,'DEF');
 assert.equal(next.earned,0);
 assert.equal(next.required,100);
});

test('single-stat grinding cannot bypass balanced character levels', () => {
 const focused={...p.DEFAULT_SAVE,strengthXp:10000};
 assert.equal(p.characterLevel(focused),2);

 assert.equal(p.characterXpProgress(focused).stat,'AGI');
 const twoStats={...focused,agilityXp:100};
 assert.equal(p.characterLevel(twoStats),3);
 const balanced={...twoStats,defenseXp:100,healthXp:100};
 assert.equal(p.characterLevel(balanced),6);

 assert.equal(p.characterXpProgress(balanced).stat,'AGI');
 assert.equal(balanced.strengthXp,10000);
});
test('even stat levels produce predictable character milestones', () => {
 for(const [xp,level] of [[0,1],[100,5],[300,9],[600,13]]) {
  assert.equal(p.characterLevel({...p.DEFAULT_SAVE,strengthXp:xp,agilityXp:xp,defenseXp:xp,healthXp:xp}),level);
 }
});
