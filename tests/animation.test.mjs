import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';

// Drive the real hook with a deterministic React/animation-frame harness.
function animationHarness() {
  let state, dependencies, effect, cleanup, now = 0, nextId = 0;
  const pending = new Map();
  const source = readFileSync(new URL('../src/game/useAnimationFrame.ts', import.meta.url), 'utf8')
    .replace(/import .*?from "react";/, '').replace('export function', 'function');
  const context = vm.createContext({
    useState(initial) {
      state ??= initial;
      return [state, value => { state = typeof value === 'function' ? value(state) : value; }];
    },
    useEffect(callback, deps) {
      if (!dependencies || deps.some((value, index) => value !== dependencies[index])) {
        dependencies = deps;
        effect = callback;
      }
    },
    performance: { now: () => now },
    requestAnimationFrame(callback) { pending.set(++nextId, callback); return nextId; },
    cancelAnimationFrame(id) { pending.delete(id); },
  });
  vm.runInContext(ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020}}).outputText, context);
  return {
    render(...args) {
      const frame = context.useAnimationFrame(...args);
      if (effect) { cleanup?.(); const run = effect; effect = null; cleanup = run(); }
      return frame;
    },
    advance(ms) {
      now += ms;
      const callbacks = [...pending.values()]; pending.clear();
      callbacks.forEach(callback => callback(now));
    },
    pending: () => pending.size,
  };
}

test('all eight player attack frames play and the last pose holds without looping', () => {
  const h = animationHarness();
  assert.equal(h.render(true, 100, 8, false, 'attack'), 0);
  for (let frame = 1; frame < 8; frame++) {
    h.advance(100);
    assert.equal(h.render(true, 100, 8, false, 'attack'), frame);
  }
  h.advance(200);
  assert.equal(h.render(true, 100, 8, false, 'attack'), 7);
  assert.equal(h.pending(), 0);
});

test('walking follows elapsed time and loops after delayed browser frames', () => {
  const h = animationHarness();
  h.render(true, 180, 2, true, 'walk:left');
  h.advance(550);
  assert.equal(h.render(true, 180, 2, true, 'walk:left'), 1);
  h.advance(180);
  assert.equal(h.render(true, 180, 2, true, 'walk:left'), 0);
});

test('switching same-length clips or shortening clips renders frame zero immediately', () => {
  const h = animationHarness();
  h.render(true, 100, 8, false, 'attack');
  h.advance(600);
  assert.equal(h.render(true, 100, 8, false, 'attack'), 6);
  assert.equal(h.render(true, 100, 8, false, 'another-attack'), 0);
  assert.equal(h.render(true, 180, 2, true, 'walk'), 0);
  assert.equal(h.pending(), 1);
  assert.equal(h.render(false, 520, 2, true, 'idle'), 0);
  assert.equal(h.pending(), 0);
});
