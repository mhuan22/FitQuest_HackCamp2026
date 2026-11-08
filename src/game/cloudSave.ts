import { requireSupabase } from "../lib/supabase";
import { normalizeSave, type SaveData } from "./progression";

export class SaveConflictError extends Error {
  constructor() { super("Progress changed in another tab or device. Reload the cloud save to continue."); }
}

function checkedSave(value: unknown): SaveData {
  if (!value || typeof value !== "object") throw new Error("Your cloud save has an invalid format. It has not been replaced.");
  const data = value as Record<string, unknown>;
  for (const field of ["strengthXp", "agilityXp", "defenseXp", "healthXp"]) {
    if (!Number.isSafeInteger(data[field]) || Number(data[field]) < 0) throw new Error("Your cloud XP could not be read. It has not been replaced.");
  }
  if (typeof data.sound !== "boolean" || !Array.isArray(data.rewards) ||
    data.rewards.some(reward => typeof reward !== "string") || (data.version !== undefined && data.version !== 2)) {
    throw new Error("Your cloud save format is not supported. It has not been replaced.");
  }
  if (data.version === 2 && (!Number.isSafeInteger(data.streak) || Number(data.streak) < 0 || typeof data.lastTrainingDate !== "string")) {
    throw new Error("Your saved training history could not be read. It has not been replaced.");
  }
  const normalized = normalizeSave(data);
  if (data.version === 2 && normalized.lastTrainingDate !== data.lastTrainingDate) {
    throw new Error("Your saved training date is invalid. It has not been replaced.");
  }
  return normalized;
}
function checkedRevision(value: unknown) {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error("The save service returned an invalid revision. Your progress has not been marked as saved.");
  }
  return Number(value);
}
export async function loadCloudSave(userId: string) {
  const client = requireSupabase();
  const [progress, profile] = await Promise.all([
    client.from("player_progress").select("data, revision").eq("user_id", userId).single(),
    client.from("profiles").select("username").eq("user_id", userId).single(),
  ]);
  if (progress.error) throw progress.error;
  if (profile.error) throw profile.error;
  return { save: checkedSave(progress.data.data), revision: checkedRevision(progress.data.revision), username: String(profile.data.username) };
}

export async function saveCloudProgress(save: SaveData, revision: number, mutationId: string) {
  const { data, error } = await requireSupabase().rpc("save_player_progress", {
    p_data: save, p_revision: revision, p_mutation_id: mutationId,
  });
  if (error?.code === "40001") throw new SaveConflictError();
  if (error?.code === "22023") throw new Error("The database rejected this save format. Apply the latest player-progress migration in Supabase, then retry. Your progress is kept on this device.");
  if (error) throw error;
  return checkedRevision(data);
}
