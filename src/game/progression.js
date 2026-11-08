export const INITIAL_STATS = {
  strength: { level: 1, xp: 0 },
  speed: { level: 1, xp: 0 },
  defense: { level: 1, xp: 0 },
  endurance: { level: 1, xp: 0 },
};

const exerciseToStat = {
  curl: "strength",
  squat: "speed",
  situp: "defense",
};

export function addXP(stats, statName, amount) {
  const current = stats[statName];

  let level = current.level;
  let xp = current.xp + Math.max(0, amount);

  // Each level costs 100 × current level.
  while (level < 10 && xp >= level * 100) {
    xp -= level * 100;
    level++;
  }

  return {
    ...stats,
    [statName]: {
      level,
      xp: level === 10 ? 0 : xp,
    },
  };
}

export function rewardRep(stats, exercise) {
  const stat = exerciseToStat[exercise];

  if (!stat) return stats;

  return addXP(stats, stat, 10);
}

// Call once after a verified running session.
export function rewardRunning(stats, verifiedSeconds) {
  const xp = Math.floor(Math.max(0, verifiedSeconds) / 30) * 10;

  return addXP(stats, "endurance", xp);
}
