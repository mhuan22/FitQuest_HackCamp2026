export type StatKey = "strength" | "agility" | "defense" | "health";
type XpKey = "strengthXp" | "agilityXp" | "defenseXp" | "healthXp";
export type SaveData = {
  strengthXp: number;
  agilityXp: number;
  defenseXp: number;
  healthXp: number;
  skin: number;
  sound: boolean;
  rewards: string[];
};

const DEFAULT_SAVE: SaveData = {
  strengthXp: 0,
  agilityXp: 0,
  defenseXp: 0,
  healthXp: 0,
  skin: 0,
  sound: true,
  rewards: [],
};

export const STAT_INFO: Record<StatKey, { label: string; short: string; xpKey: XpKey }> = {
  strength: { label: "Strength", short: "STR", xpKey: "strengthXp" },
  agility: { label: "Agility", short: "AGI", xpKey: "agilityXp" },
  defense: { label: "Defense", short: "DEF", xpKey: "defenseXp" },
  health: { label: "Vitality", short: "VIT", xpKey: "healthXp" },
};

export const levelFromXp = (xp: number) => Math.floor(xp / 100) + 1;
export const levelProgress = (xp: number) => xp % 100;

export function loadSave(modelCount: number): SaveData {
  try {
    const parsed = JSON.parse(localStorage.getItem("ironvale-save") || "");
    const save = { ...DEFAULT_SAVE, ...parsed };
    return { ...save, skin: Math.abs(Number(save.skin) || 0) % modelCount };
  } catch {
    return DEFAULT_SAVE;
  }
}
