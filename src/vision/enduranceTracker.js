import { jointVisible } from './repCounter.js';

const maxFrameGapMs = 220;
const confirmationMs = 200;
const motionThreshold = 0.07; // Fraction of the shorter image dimension per second.
const minimumLandmarks = 2;

export function createEnduranceTracker() {
  let durationMs = 0;
  let previous = null;
  let movingMs = 0;
  let phase = 'framing';

  function loseTracking() {
    previous = null;
    movingMs = 0;
    phase = 'framing';
  }

  function update(points, width, height, time) {
    const visible = points.map(point => jointVisible(point) ? point : null);
    if (!(width > 0 && height > 0 && Number.isFinite(time)) ||
      visible.filter(Boolean).length < minimumLandmarks) {
      loseTracking();
      return { phase, durationMs };
    }

    const elapsed = previous ? time - previous.time : 0;
    if (previous && elapsed === 0 && previous.width === width && previous.height === height) {
      return { phase, durationMs };
    }

    let tracked = 0;
    let moving = 0;
    if (previous && elapsed > 0 && elapsed <= maxFrameGapMs &&
      previous.width === width && previous.height === height) {
      const distanceThreshold = motionThreshold * Math.min(width, height) * elapsed / 1000;
      visible.forEach((point, index) => {
        const last = previous.points[index];
        if (!point || !last) return;
        tracked += 1;
        const distance = Math.hypot((point.x - last.x) * width, (point.y - last.y) * height);
        if (distance >= distanceThreshold) moving += 1;
      });
    }
    previous = { points: visible, width, height, time };

    if (moving >= minimumLandmarks) {
      const wasConfirmed = movingMs >= confirmationMs;
      movingMs += elapsed;
      if (movingMs >= confirmationMs) durationMs += wasConfirmed ? elapsed : movingMs;
    } else {
      movingMs = 0;
    }

    phase = 'searching';
    if (tracked < minimumLandmarks) phase = 'framing';
    if (movingMs >= confirmationMs) phase = 'moving';
    return { phase, durationMs };
  }

  return { update, loseTracking };
}
