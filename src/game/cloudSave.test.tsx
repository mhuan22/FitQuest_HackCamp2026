import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SAVE } from "./progression";
import { loadCloudSave, saveCloudProgress, SaveConflictError } from "./cloudSave";
const mocks = vi.hoisted(() => ({ progress: vi.fn(), profile: vi.fn(), rpc: vi.fn(), eq: vi.fn() }));
vi.mock("../lib/supabase", () => ({ requireSupabase: () => ({
  from: (table: string) => ({ select: () => ({ eq: (field: string, user: string) => {
    mocks.eq(table, field, user);
    return { single: table === "player_progress" ? mocks.progress : mocks.profile };
  } }) }), rpc: mocks.rpc,
}) }));
const save = { ...DEFAULT_SAVE, strengthXp: 300, agilityXp: 100, streak: 3, lastTrainingDate: "2026-11-08", rewards: ["Slime Band"], sound: false };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.progress.mockResolvedValue({ data: { data: save, revision: 5 }, error: null });
  mocks.profile.mockResolvedValue({ data: { username: "RookPlayer" }, error: null });
  mocks.rpc.mockResolvedValue({ data: 6, error: null });
});
describe("account cloud saves", () => {
  it("loads all persistent user progression under the authenticated account ID", async () => {
    expect(await loadCloudSave("user-a")).toEqual({ save, revision: 5, username: "RookPlayer" });
    expect(mocks.eq).toHaveBeenCalledWith("player_progress", "user_id", "user-a");
    expect(mocks.eq).toHaveBeenCalledWith("profiles", "user_id", "user-a");
  });
  it("migrates legacy XP once, without changing current-format XP", async () => {
    mocks.progress.mockResolvedValue({ data: { data: { strengthXp: 200, agilityXp: 0, defenseXp: 0, healthXp: 0, skin: 3, rewards: [], sound: true }, revision: 0 }, error: null });
    const first = await loadCloudSave("user-a");
    expect(first.save.strengthXp).toBe(300);
    mocks.progress.mockResolvedValue({ data: { data: first.save, revision: 1 }, error: null });
    expect((await loadCloudSave("user-a")).save.strengthXp).toBe(300);
  });
  it("refuses corrupt cloud data instead of replacing it with an empty save", async () => {
    mocks.progress.mockResolvedValue({ data: { data: { ...save, strengthXp: -1 }, revision: 5 }, error: null });
    await expect(loadCloudSave("user-a")).rejects.toThrow("has not been replaced");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses an invalid saved training date", async () => {
    mocks.progress.mockResolvedValue({ data: { data: { ...save, lastTrainingDate: "2026-02-31" }, revision: 5 }, error: null });
    await expect(loadCloudSave("user-a")).rejects.toThrow("has not been replaced");
  });
  it("does not fall back to local/default progress on a failed cloud load", async () => {
    mocks.progress.mockResolvedValue({ data: null, error: new Error("Network unavailable") });
    await expect(loadCloudSave("user-a")).rejects.toThrow("Network unavailable");
  });
  it("sends the complete save with the original revision and retry identity", async () => {
    expect(await saveCloudProgress(save, 5, "mutation-id")).toBe(6);
    expect(mocks.rpc).toHaveBeenCalledWith("save_player_progress", { p_data: save, p_revision: 5, p_mutation_id: "mutation-id" });
  });
  it("identifies stale saves and outdated database validators", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
    await expect(saveCloudProgress(save, 5, "id")).rejects.toBeInstanceOf(SaveConflictError);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
    await expect(saveCloudProgress(save, 5, "id")).rejects.toThrow("migration");
  });
  it.each([null, true, "", 1.5, -1])("does not report success for invalid acknowledgement %s", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(saveCloudProgress(save, 5, "id")).rejects.toThrow("invalid revision");
  });
});
