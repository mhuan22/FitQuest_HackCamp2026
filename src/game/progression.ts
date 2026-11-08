export type StatKey = "strength" | "agility" | "defense" | "health";
type XpKey = "strengthXp" | "agilityXp" | "defenseXp" | "healthXp";
export type SaveData = {
  strengthXp: number; agilityXp: number; defenseXp: number; healthXp: number;
  version: number; streak: number; lastTrainingDate: string;
  sound: boolean; rewards: string[];
};
export const DEFAULT_SAVE: SaveData = {
  strengthXp: 0, agilityXp: 0, defenseXp: 0, healthXp: 0,
  version: 2, streak: 0, lastTrainingDate: "", sound: true, rewards: [],
};
export const STAT_INFO: Record<StatKey, { label: string; short: string; xpKey: XpKey }> = {
  strength: { label: "Strength", short: "STR", xpKey: "strengthXp" },
  agility: { label: "Agility", short: "AGI", xpKey: "agilityXp" },
  defense: { label: "Defense", short: "DEF", xpKey: "defenseXp" },
  health: { label: "Vitality", short: "VIT", xpKey: "healthXp" },
};
const cleanXp = (xp: number) => Number.isFinite(xp) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(xp))) : 0;
export const levelFromXp = (xp: number) => Math.floor((1 + Math.sqrt(1 + 8 * cleanXp(xp) / 100)) / 2);
export function xpProgress(xp: number) {
  const level = levelFromXp(xp);
  const earned = cleanXp(xp) - 50 * level * (level - 1);
  return { level, earned, required: level * 100, percent: earned / level };
}
export const levelProgress = (xp: number) => xpProgress(xp).percent;
export function characterLevel(s: SaveData) {
  const levels = Object.values(STAT_INFO).map(stat => levelFromXp(s[stat.xpKey]));
  const ceiling = Math.min(...levels) + 1;
  return 1 + levels.reduce((total, level) => total + Math.min(level, ceiling) - 1, 0);
}
export function characterXpProgress(s: SaveData) {
  const stats = Object.values(STAT_INFO).map(stat => ({ ...xpProgress(s[stat.xpKey]), stat: stat.short }));
  const lowest = Math.min(...stats.map(stat => stat.level));
  // Only a lowest-level stat can move balanced character progression forward.
  return stats.filter(stat => stat.level === lowest).reduce((closest, stat) => stat.required - stat.earned < closest.required - closest.earned ? stat : closest);
}
export const ULTIMATE_UNLOCK_LEVEL = 5;
export const isUltimateUnlocked = (s: SaveData) => characterLevel(s) >= ULTIMATE_UNLOCK_LEVEL;
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function currentStreak(s: SaveData, date = new Date()) {
  const yesterday = new Date(date); yesterday.setDate(yesterday.getDate()-1);
  return [dateKey(date), dateKey(yesterday)].includes(s.lastTrainingDate) ? s.streak : 0;
}
export function trainingDay(s: SaveData, date = new Date()): SaveData {
  const key = dateKey(date);
  if (!Number.isFinite(date.getTime()) || s.lastTrainingDate >= key) return s;
  const yesterday = new Date(date); yesterday.setDate(yesterday.getDate()-1);
  const streak = s.lastTrainingDate === dateKey(yesterday) ? s.streak + 1 : 1;
  return { ...s, streak, lastTrainingDate: key };
}
export function nextDemoTrainingDay(s: SaveData, date: Date) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  return { date: nextDate, save: trainingDay(s, nextDate) };
}
export function normalizeSave(input: unknown): SaveData {
  const parsed = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const save = { ...DEFAULT_SAVE, rewards: [] as string[] };
  for (const { xpKey } of Object.values(STAT_INFO)) {
    const xp = cleanXp(typeof parsed[xpKey] === "number" ? parsed[xpKey] as number : 0);
    const oldLevel = Math.floor(xp / 100) + 1;
    save[xpKey] = cleanXp(parsed.version === 2 ? xp : 50 * oldLevel * (oldLevel - 1) + xp % 100);
  }
  save.sound = typeof parsed.sound === "boolean" ? parsed.sound : true;
  save.rewards = Array.isArray(parsed.rewards) ? parsed.rewards.filter((r): r is string => typeof r === "string") : [];
  const last = typeof parsed.lastTrainingDate === "string" ? parsed.lastTrainingDate : "";
  save.lastTrainingDate = /^\d{4}-\d{2}-\d{2}$/.test(last) && dateKey(new Date(last + "T12:00:00")) === last ? last : "";
  save.streak = save.lastTrainingDate && typeof parsed.streak === "number" ? cleanXp(parsed.streak) : 0;
  return save;
}
export function loadSave(storageKey = "ironvale-save"): SaveData {
  try { return normalizeSave(JSON.parse(localStorage.getItem(storageKey) || "null")); }
  catch { return normalizeSave(null); }
}
