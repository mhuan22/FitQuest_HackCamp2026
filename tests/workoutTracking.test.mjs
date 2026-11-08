import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepCounter, jointVisible } from '../src/vision/repCounter.js';
import { createEnduranceTracker } from '../src/vision/enduranceTracker.js';
const point = (x, y) => ({ x, y, visibility: 1, presence: 1 });
function pose(indices, coordinates) {
  const result = Array(33).fill(null);
  indices.forEach((index, i) => { result[index] = point(...coordinates[i]); });
  return result;
}
const movements = {
  curl: { indices: [11, 13, 15], start: [[.5,.25],[.5,.5],[.5,.75]], target: [[.5,.25],[.5,.5],[.65,.35]] },
  squat: { indices: [23, 25, 27], start: [[.5,.25],[.5,.5],[.5,.75]], target: [[.25,.5],[.5,.5],[.5,.75]] },
  situp: { indices: [11, 23, 25], start: [[.75,.5],[.5,.5],[.5,.75]], target: [[.5,.25],[.5,.5],[.5,.75]] },
};
for (const [exercise, movement] of Object.entries(movements)) {
  test(`${exercise} counts a full controlled movement, not a held pose or half rep`, () => {
    const tracker = createRepCounter(exercise);
    let time = 0, result;
    const hold = (coordinates, frames = 8) => {
      for (let i=0;i<frames;i++,time+=100) result=tracker.update(pose(movement.indices, coordinates), 1000, 1000, time);
    };
    hold(movement.start); assert.equal(result.reps,0);
    hold(movement.target); assert.equal(result.reps,0);
    hold(movement.start); assert.equal(result.reps,1);
    hold(movement.start,20); assert.equal(result.reps,1);
  });
}
test('a long tracking interruption cannot finish an old rep', () => {
  const movement=movements.curl, tracker=createRepCounter('curl');
  let time=0,result;
  for(const coordinates of [movement.start,movement.target]) {
    for(let i=0;i<8;i++,time+=100) result=tracker.update(pose(movement.indices,coordinates),1000,1000,time);
  }
  assert.equal(result.phase,'finish');
  time+=3000;
  for(let i=0;i<8;i++,time+=100) result=tracker.update(pose(movement.indices,movement.start),1000,1000,time);
  assert.equal(result.reps,0);
});
test('invisible and out-of-frame joints are rejected', () => {
  assert.equal(jointVisible({...point(.5,.5),visibility:.2}),false);
  assert.equal(jointVisible(point(1,.5)),false);
  assert.equal(jointVisible({...point(.5,.5),presence:.2}),false);
});
test('treadmill time counts sustained visible movement, excluding stillness and frame gaps', () => {
  const tracker=createEnduranceTracker();
  let time=0,result;
  for(let i=0;i<10;i++,time+=100) result=tracker.update([point(.3,.4),point(.6,.4)],1000,1000,time);
  assert.equal(result.durationMs,0);
  for(let i=0;i<10;i++,time+=100) result=tracker.update([point(i%2?.32:.3,.4),point(i%2?.62:.6,.4)],1000,1000,time);
  assert.ok(result.durationMs>=800 && result.durationMs<=1000);
  const earned=result.durationMs;
  time+=5000;
  result=tracker.update([point(.4,.4),point(.7,.4)],1000,1000,time);
  assert.equal(result.durationMs,earned);
  result=tracker.update([],1000,1000,time+100);
  assert.equal(result.durationMs,earned);
  assert.equal(result.phase,'framing');
});
