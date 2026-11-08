import { normalizeSave, type SaveData } from "./progression";

export type PendingSave = { save: SaveData; id: string; revision: number; latestSave?: SaveData };
const key = (userId: string) => `ironvale-pending:${userId}`;
export function readRecovery(userId: string): PendingSave | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.userId !== userId || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id) || !value.save || value.save.version !== 2) return null;
    return { save: normalizeSave(value.save), id: value.id, revision: value.revision, latestSave: value.latestSave?.version === 2 ? normalizeSave(value.latestSave) : undefined };
  } catch { return null; }
}
export function writeRecovery(userId: string, mutation: PendingSave) {
  localStorage.setItem(key(userId), JSON.stringify({ ...mutation, userId }));
}
export function clearRecovery(userId: string) {
  localStorage.removeItem(key(userId));
}
