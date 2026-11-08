import { characterLevel, levelFromXp, STAT_INFO, type SaveData } from "./progression";
export type BossKey = "slime" | "golem" | "owl" | "shellback";
export const BOSS_REQUIREMENTS = {
  slime: { level: 1, reward: "", previous: "" },
  golem: { level: 3, reward: "Slime Band", previous: "Training Slime" },
  owl: { level: 5, reward: "Golem Crest", previous: "Stone Golem" },
  shellback: { level: 7, reward: "Frost Feather", previous: "Frost Owl" },
} as const;
export function bossLockReason(save: SaveData, boss: BossKey) {
  const requirement = BOSS_REQUIREMENTS[boss];
  const missing = [];
  if (characterLevel(save) < requirement.level) missing.push(`Reach Character Level ${requirement.level}`);
  if (requirement.reward && !save.rewards.includes(requirement.reward)) missing.push(`Defeat the ${requirement.previous}`);
  return missing.join(" · ");
}
// Demo controls grant real stat XP, so level-based abilities stay consistent.
export function raiseDemoLevel(save: SaveData, target: number): SaveData {
  if (!Number.isInteger(target) || target < 1 || target > 100) return save;
  const next = { ...save };
  while (characterLevel(next) < target) {
    const stat = Object.values(STAT_INFO).reduce((lowest, stat) =>
      levelFromXp(next[stat.xpKey]) < levelFromXp(next[lowest.xpKey]) ? stat : lowest);
    const level = levelFromXp(next[stat.xpKey]);
    next[stat.xpKey] = 50 * level * (level + 1);
  }
  return next;
}
export function unlockDemoBoss(save: SaveData, boss: BossKey): SaveData {
  const next = raiseDemoLevel(save, BOSS_REQUIREMENTS[boss].level);
  const order: BossKey[] = ["slime", "golem", "owl", "shellback"];
  const prerequisites = order.slice(0, order.indexOf(boss) + 1).map(key => BOSS_REQUIREMENTS[key].reward).filter(Boolean);
  return { ...next, rewards: [...new Set([...next.rewards, ...prerequisites])] };
}
