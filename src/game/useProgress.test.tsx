import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgress } from "./useProgress";
import { saveCloudProgress, SaveConflictError } from "./cloudSave";
import type { SaveData } from "./progression";

vi.mock("./cloudSave", () => ({ saveCloudProgress: vi.fn(), SaveConflictError: class extends Error {} }));
const defaults: SaveData = { strengthXp: 0, agilityXp: 0, defenseXp: 0, healthXp: 0, skin: 0, sound: true, rewards: [] };
let root: Root;
let state: ReturnType<typeof useProgress>;
function Harness({ userId }: { userId?: string }) {
  state = useProgress(userId, userId ? defaults : undefined, 0, 6);
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
    await act(async () => state.setSave({ ...defaults, skin: 3 }));
    expect(JSON.parse(localStorage.getItem("ironvale-save")!).skin).toBe(3);
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
