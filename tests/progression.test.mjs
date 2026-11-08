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
  assert.equal(p.isUltimateUnlocked(save),false);
 }
 assert.equal(p.dateKey(date),'2027-01-02');
 // Skipping a calendar day breaks the streak.
 date.setDate(date.getDate()+2);
 ({save,date}=p.nextDemoTrainingDay(save,date));
 assert.equal(save.streak,1);

});

test('Ultimate requires character level five, regardless of legacy unlocks or streaks', () => {
 const legacy=p.normalizeSave({version:2,ultimateUnlocked:true,streak:30,lastTrainingDate:'2026-12-30'});
 assert.equal(p.isUltimateUnlocked(legacy),false);
 const level4={...p.DEFAULT_SAVE,strengthXp:100,agilityXp:100,defenseXp:100};
 assert.equal(p.characterLevel(level4),4);
 assert.equal(p.isUltimateUnlocked(level4),false);
 const level5={...level4,healthXp:100};
 assert.equal(p.characterLevel(level5),5);
 assert.equal(p.isUltimateUnlocked(level5),true);
 assert.equal(p.isUltimateUnlocked(p.normalizeSave(level5)),true);
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

test('single-stat grinding cannot bypass balanced character levels or Ultimate unlock', () => {
 const focused={...p.DEFAULT_SAVE,strengthXp:10000};
 assert.equal(p.characterLevel(focused),2);
 assert.equal(p.isUltimateUnlocked(focused),false);
 assert.equal(p.characterXpProgress(focused).stat,'AGI');
 const twoStats={...focused,agilityXp:100};
 assert.equal(p.characterLevel(twoStats),3);
 const balanced={...twoStats,defenseXp:100,healthXp:100};
 assert.equal(p.characterLevel(balanced),6);
 assert.equal(p.isUltimateUnlocked(balanced),true);
 assert.equal(p.characterXpProgress(balanced).stat,'AGI');
 assert.equal(balanced.strengthXp,10000);
});
test('even stat levels produce predictable character milestones', () => {
 for(const [xp,level] of [[0,1],[100,5],[300,9],[600,13]]) {
  assert.equal(p.characterLevel({...p.DEFAULT_SAVE,strengthXp:xp,agilityXp:xp,defenseXp:xp,healthXp:xp}),level);
 }
});
