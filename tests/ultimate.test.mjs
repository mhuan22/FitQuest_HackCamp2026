import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { ULTIMATE } = await import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('../src/game/ultimate.ts', import.meta.url), 'utf8'))).toString('base64')}`);
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sourceFile = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const game = sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'App');
const turn = game.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'battleTurn').getText(sourceFile);
function fight(bossHp) {
  const battle = { boss: 'slime', bossHp, playerHp: 100, busy: false, result: null, charge: 3, opening: false, turn: 0, bossAttackCount: 0, heavyReady: false };
  let state = { ...battle }, now = 0;
  const timers = [];
  const context = vm.createContext({
    battle, turnLocked: { current: false }, ultimateUnlocked: true, ultimateStatus: '',
    save: { ultimateUnlocked: true }, strength: 1, defense: 1, agility: 0,
    ULTIMATE, PLAYER_ATTACK_MS: 800, activeBoss: { name: 'Slime', attack: 5 },
    bossAttackTiming: () => ({ impact: 420, duration: 735 }),
    later: (callback, delay) => timers.push({ callback, at: now + delay }),
    setBattle: update => { state = update(state); },
    setSave: () => {},
  });
  vm.runInContext(compile(turn), context);
  context.battleTurn('special');
  return {
    state: () => state,
    advance(to) {
      while (true) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > to) break;
        const timer = timers.shift(); now = timer.at; timer.callback();
      }
      now = to;
    },
  };
}
test('Ultimate charges first, lands damage on the cinematic impact, and counters after recovery', () => {
  const h = fight(100);
  assert.equal(h.state().ultimate, true);
  assert.equal(h.state().action, 'idle');
  assert.equal(h.state().charge, 0);
  h.advance(ULTIMATE.windup);
  assert.equal(h.state().action, 'attack');
  assert.equal(h.state().bossHp, 100);
  h.advance(ULTIMATE.impact - 1);
  assert.equal(h.state().bossHp, 100);
  h.advance(ULTIMATE.impact);
  assert.equal(h.state().bossHp, 76);
  assert.equal(h.state().bossAction, 'hit');
  h.advance(ULTIMATE.duration - 1);
  assert.equal(h.state().ultimate, true);
  h.advance(ULTIMATE.duration);
  assert.equal(h.state().ultimate, false);
  assert.equal(h.state().bossAction, 'attack');
});
test('a finishing Ultimate completes its cinematic before the victory overlay', () => {
  const h = fight(10);
  h.advance(ULTIMATE.impact);
  assert.equal(h.state().bossHp, 0);
  assert.equal(h.state().result, null);
  h.advance(ULTIMATE.duration);
  assert.equal(h.state().ultimate, false);
  assert.equal(h.state().result, 'victory');
  assert.equal(h.state().busy, false);
});
