import { requireSupabase } from "../lib/supabase";
import type { SaveData } from "./progression";

export class SaveConflictError extends Error {
  constructor() { super("Progress changed in another tab or device. Reload the cloud save to continue."); }
}

export async function loadCloudSave(userId: string) {
  const client = requireSupabase();
  const [progress, profile] = await Promise.all([
    client.from("player_progress").select("data, revision").eq("user_id", userId).single(),
    client.from("profiles").select("username").eq("user_id", userId).single(),
  ]);
  if (progress.error) throw progress.error;
  if (profile.error) throw profile.error;
  return { save: progress.data.data as SaveData, revision: Number(progress.data.revision), username: String(profile.data.username) };
}

export async function saveCloudProgress(save: SaveData, revision: number, mutationId: string) {
  const { data, error } = await requireSupabase().rpc("save_player_progress", {
    p_data: save, p_revision: revision, p_mutation_id: mutationId,
  });
  if (error?.code === "40001") throw new SaveConflictError();
  if (error) throw error;
  return Number(data);
}
