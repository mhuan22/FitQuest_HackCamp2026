export const exercises = {
  curl: {
    label: 'Bicep curl',
    stat: 'Strength',
    sides: [[11, 13, 15], [12, 14, 16]],
    start: 'Straighten your arm to begin.',
    move: 'Curl your wrist toward your shoulder.',
    finish: 'Lower your hand to finish the rep.',
    frame: 'Keep your shoulder, elbow, and wrist in view.',
    isStart: angle => angle >= 150,
    isTarget: angle => angle <= 90,
  },
  squat: {
    label: 'Squat',
    stat: 'Speed',
    sides: [[23, 25, 27], [24, 26, 28]],
    start: 'Stand tall to begin.',
    move: 'Lower until your thigh is close to level.',
    finish: 'Stand tall to finish the rep.',
    frame: 'Step back until your hip, knee, and ankle are visible.',
    isStart: (angle, thighSlope) => angle >= 155 && thighSlope >= 55,
    isTarget: (angle, thighSlope) => angle <= 110 && thighSlope <= 15,
  },
};

const holdMs = 150;
export const staleMs = 550;

export function jointVisible(point) {
  return point && point.visibility >= 0.6 && (point.presence ?? 1) >= 0.6 &&
    point.x > 0.01 && point.x < 0.99 && point.y > 0.01 && point.y < 0.99;
}

export function createRepCounter(exerciseId) {
  const exercise = exercises[exerciseId];
  let reps = 0;
  let phase, side, angle, slope, holdSince, lastFrame;

  function loseTracking() {
    phase = 'start';
    side = null;
    angle = slope = holdSince = lastFrame = null;
  }
  loseTracking();

  function update(points, width, height, time) {
    if (lastFrame !== null && (time - lastFrame > staleMs || time < lastFrame)) {
      loseTracking();
    }

    const visibleSides = exercise.sides.filter(indices => indices.every(index => jointVisible(points[index])));
    if (side && !visibleSides.includes(side)) loseTracking();
    side ??= visibleSides.sort((a, b) => confidence(b) - confidence(a))[0];

    function confidence(indices) {
      return Math.min(...indices.map(index => points[index].visibility));
    }

    if (!side || !(width > 0 && height > 0)) {
      loseTracking();
      return { reps, phase: 'framing', angle: null };
    }

    const [first, middle, last] = side.map(index => points[index]);
    const ax = (first.x - middle.x) * width;
    const ay = (first.y - middle.y) * height;
    const bx = (last.x - middle.x) * width;
    const by = (last.y - middle.y) * height;

    if (Math.min(Math.hypot(ax, ay), Math.hypot(bx, by)) < Math.min(width, height) * 0.02) {
      loseTracking();
      return { reps, phase: 'framing', angle: null };
    }

    const degrees = 180 / Math.PI;
    const measuredAngle = Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by) * degrees;
    const thighSlope = Math.atan2(-ay, Math.abs(ax)) * degrees;
    const weight = lastFrame === null ? 1 : 1 - Math.exp(-(time - lastFrame) / 80);
    angle = angle === null ? measuredAngle : angle + (measuredAngle - angle) * weight;
    slope = slope === null ? thighSlope : slope + (thighSlope - slope) * weight;
    lastFrame = time;

    const reached = phase === 'move' ? exercise.isTarget(angle, slope) : exercise.isStart(angle, slope);
    holdSince = reached ? (holdSince ?? time) : null;
    let counted = false;

    if (holdSince !== null && time - holdSince >= holdMs) {
      holdSince = null;
      counted = phase === 'finish';
      if (counted) reps += 1;
      phase = phase === 'move' ? 'finish' : 'move';
    }
    return { reps, phase, angle: Math.round(angle), counted };
  }

  return { update, loseTracking };
}
