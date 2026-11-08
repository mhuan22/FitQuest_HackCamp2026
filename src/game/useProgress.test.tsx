import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgress } from "./useProgress";
import { saveCloudProgress, SaveConflictError } from "./cloudSave";
import { DEFAULT_SAVE, type SaveData } from "./progression";

vi.mock("./cloudSave", () => ({ saveCloudProgress: vi.fn(), SaveConflictError: class extends Error {} }));
const defaults: SaveData = { ...DEFAULT_SAVE, rewards: [] };
let root: Root;
let state: ReturnType<typeof useProgress>;
function Harness({ userId, storageKey }: { userId?: string; storageKey?: string }) {
  state = useProgress(userId, userId ? defaults : undefined, 0, storageKey);
  return null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.mocked(saveCloudProgress).mockReset();
  root = createRoot(document.createElement("div"));
});
afterEach(async () => { await act(async () => root.unmount()); });

describe("progress persistence", () => {
  it("keeps account progress separate from the guest save", async () => {
    localStorage.setItem("ironvale-save", JSON.stringify({ ...defaults, strengthXp: 500 }));
    vi.mocked(saveCloudProgress).mockResolvedValue(1);
    await act(async () => root.render(<Harness userId="account-a" />));
    expect(state.save.strengthXp).toBe(0);
    await act(async () => state.setSave({ ...defaults, strengthXp: 50 }));
    expect(saveCloudProgress).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("ironvale-save")!).strengthXp).toBe(500);
    expect(state.status).toBe("saved");
  });

  it("writes guest changes locally without calling the cloud", async () => {
    await act(async () => root.render(<Harness />));
    await act(async () => state.setSave({ ...defaults, sound: false }));
    expect(JSON.parse(localStorage.getItem("ironvale-save")!).sound).toBe(false);
    expect(saveCloudProgress).not.toHaveBeenCalled();
  });

  it("serializes changes made while a save is in flight", async () => {
    let finish!: (revision: number) => void;
    vi.mocked(saveCloudProgress).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(2);
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 50 }));
    await act(async () => state.setSave({ ...defaults, strengthXp: 100 }));
    expect(saveCloudProgress).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("saving");
    await act(async () => finish(1));
    expect(saveCloudProgress).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveCloudProgress).mock.calls[1][1]).toBe(1);
    expect(vi.mocked(saveCloudProgress).mock.calls[1][0].strengthXp).toBe(100);
    expect(state.status).toBe("saved");
  });

  it("retries an ambiguous failure with the same mutation ID", async () => {
    let finish!: (revision: number) => void;
    vi.mocked(saveCloudProgress).mockRejectedValueOnce(new Error("Network failed"))
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 50 }));
    expect(state.status).toBe("error");
    const first = vi.mocked(saveCloudProgress).mock.calls[0];
    await act(async () => state.retry());
    expect(vi.mocked(saveCloudProgress).mock.calls[1]).toEqual(first);
    expect(state.blocked).toBe(true);
    await act(async () => finish(1));
    expect(state.status).toBe("saved");
    expect(state.blocked).toBe(false);
  });

  it("does not automatically overwrite a revision conflict", async () => {
    vi.mocked(saveCloudProgress).mockRejectedValue(new SaveConflictError());
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 50 }));
    expect(state.status).toBe("conflict");
    await act(async () => state.setSave({ ...defaults, strengthXp: 100 }));
    expect(saveCloudProgress).toHaveBeenCalledTimes(1);
  });
});

describe("demo save isolation", () => {
  it("writes demo progress separately from the ordinary guest save", async () => {
    localStorage.setItem("ironvale-save", JSON.stringify({ ...defaults, strengthXp: 100 }));
    await act(async () => root.render(<Harness storageKey="ironvale-demo" />));
    expect(state.save.strengthXp).toBe(0);
    await act(async () => state.setSave({ ...defaults, strengthXp: 200 }));
    expect(JSON.parse(localStorage.getItem("ironvale-demo")!).strengthXp).toBe(200);
    expect(JSON.parse(localStorage.getItem("ironvale-save")!).strengthXp).toBe(100);
    expect(saveCloudProgress).not.toHaveBeenCalled();
  });
});

describe("durable account recovery", () => {
  it("restores a failed upload after refresh and retries the same request", async () => {
    vi.mocked(saveCloudProgress).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(1);
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 50, streak: 2, lastTrainingDate: "2026-11-08", rewards: ["Slime Band"] }));
    const first = vi.mocked(saveCloudProgress).mock.calls[0];
    expect(localStorage.getItem("ironvale-pending:account-a")).not.toBeNull();
    await act(async () => root.unmount());
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness userId="account-a" />));
    expect(vi.mocked(saveCloudProgress).mock.calls[1]).toEqual(first);
    expect(state.save.strengthXp).toBe(50);
    expect(state.save.streak).toBe(2);
    expect(state.save.rewards).toEqual(["Slime Band"]);
    expect(state.status).toBe("saved");
    expect(localStorage.getItem("ironvale-pending:account-a")).toBeNull();
  });

  it("preserves newer changes made while an older upload is in flight", async () => {
    let fail!: (error: Error) => void;
    vi.mocked(saveCloudProgress).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 50 }));
    await act(async () => state.setSave({ ...defaults, strengthXp: 100 }));
    await act(async () => fail(new Error("Offline")));
    await act(async () => root.unmount());
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness userId="account-a" />));
    expect(vi.mocked(saveCloudProgress).mock.calls[1][0].strengthXp).toBe(50);
    expect(vi.mocked(saveCloudProgress).mock.calls[2][0].strengthXp).toBe(100);
    expect(vi.mocked(saveCloudProgress).mock.calls[2][1]).toBe(1);
    expect(state.save.strengthXp).toBe(100);
    expect(state.status).toBe("saved");
  });

  it("never restores another account's failed upload", async () => {
    vi.mocked(saveCloudProgress).mockRejectedValueOnce(new Error("Offline"));
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 100 }));
    await act(async () => root.unmount());
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Harness userId="account-b" />));
    expect(state.save.strengthXp).toBe(0);
    expect(saveCloudProgress).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("ironvale-pending:account-a")).not.toBeNull();
  });

  it("retries network failures on reconnect but requires explicit conflict resolution", async () => {
    vi.mocked(saveCloudProgress).mockRejectedValueOnce(new Error("Offline")).mockRejectedValueOnce(new SaveConflictError());
    await act(async () => root.render(<Harness userId="account-a" />));
    await act(async () => state.setSave({ ...defaults, strengthXp: 100 }));
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(saveCloudProgress).toHaveBeenCalledTimes(2);
    expect(state.status).toBe("conflict");
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(saveCloudProgress).toHaveBeenCalledTimes(2);
    await act(async () => state.discardRecovery());
    expect(localStorage.getItem("ironvale-pending:account-a")).toBeNull();
  });
});
