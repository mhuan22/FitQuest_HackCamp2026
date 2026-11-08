import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_SAVE, type SaveData } from "./game/progression";
const mocks = vi.hoisted(() => ({ save: vi.fn(), cameraProgress: null as null | ((amount: number) => void) }));
vi.mock("./game/cloudSave", () => ({ saveCloudProgress: mocks.save, SaveConflictError: class extends Error {} }));
vi.mock("./vision/WorkoutCamera", () => ({ default: ({ onProgress }: { onProgress: (amount: number) => void }) => { mocks.cameraProgress = onProgress; return <div data-testid="camera" />; } }));
let root: Root, host: HTMLDivElement;
const defaults = { ...DEFAULT_SAVE, rewards: [] };
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  mocks.save.mockReset().mockImplementation(async (_save: SaveData, revision: number) => revision + 1);
  mocks.cameraProgress = null;
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
async function mount(save?: SaveData) {
  await act(async () => root.render(<App userId={save ? "account-a" : undefined} username="Player" initialSave={save} onLogout={async () => {}} onReload={() => {}} />));
}
async function click(text: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === text);
  expect(button, `Button ${text} exists`).toBeTruthy();
  expect(button!.disabled, `Button ${text} is enabled`).toBe(false);
  await act(async () => button!.click());
}
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function enterGym() { await click("ENTER GYM"); await advance(1500); }
async function station(selector: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click());
  await advance(1000);
  await click("BEGIN");
}

describe("game integration", () => {
  it("saves earned reps and completed-session streaks for an account without demo shortcuts", async () => {
    await mount(defaults);
    expect(host.querySelector("details.demo-controls")).toBeNull();
    await enterGym();
    await station(".dumbbell-station");
    await click("ENABLE CAMERA");
    expect(mocks.cameraProgress).toBeTypeOf("function");
    for (let i = 0; i < 5; i++) await act(async () => mocks.cameraProgress!(1));
    expect(host.textContent).toContain("SESSION COMPLETE");
    const saved = mocks.save.mock.calls.at(-1)![0] as SaveData;
    expect(saved.strengthXp).toBe(50);
    expect(saved.streak).toBe(1);
    expect(saved.lastTrainingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(host.textContent).toContain("Progress saved to account");
  });

  it("awards treadmill XP only at 30 active seconds and caps the completed target", async () => {
    await mount(defaults);
    await enterGym(); await station(".treadmill-station"); await click("ENABLE CAMERA");
    await act(async () => mocks.cameraProgress!(29000));
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => mocks.cameraProgress!(1000));
    expect((mocks.save.mock.calls.at(-1)![0] as SaveData).healthXp).toBe(10);
    await act(async () => mocks.cameraProgress!(30000));
    expect((mocks.save.mock.calls.at(-1)![0] as SaveData).healthXp).toBe(10);
  });

  it("keeps demo progression local and restores it after remounting", async () => {
    await mount();
    await click("Reach Level 5");
    const saved = JSON.parse(localStorage.getItem("ironvale-demo")!);
    expect(saved.strengthXp).toBe(100);
    expect(saved.healthXp).toBe(100);
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => root.unmount()); root = createRoot(host);
    await mount();
    expect(host.textContent).toContain("Ultimate unlocked");
    expect(host.querySelector(".character-level")!.textContent).toBe("LV 5");
  });

  it("keeps the next boss locked until its level requirement is met", async () => {
    await mount({ ...defaults, rewards: ["Slime Band"] });
    await click("BOSS GATE"); await advance(1000);
    const fight = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes("FIGHT"))!;
    expect(fight.disabled).toBe(true);
    expect(host.textContent).toContain("Reach Character Level 3");
  });

  it("plays Ultimate from a real command click and saves the resulting boss reward", async () => {
    await mount(); await click("Reach Level 5"); await click("BOSS GATE"); await advance(1000);
    await click("FIGHT SLIME"); await advance(600); await click("Fill Charges");
    const ultimate = host.querySelector<HTMLButtonElement>('[aria-label^="Ultimate:"]')!;
    expect(ultimate.disabled).toBe(false);
    await act(async () => ultimate.click());
    expect(host.querySelector(".ultimate-fx")).not.toBeNull();
    expect(host.querySelector(".player-fighter .floating-character-progress")).not.toBeNull();
    await advance(2100);
    expect(host.querySelector(".ultimate-fx")).toBeNull();
    await advance(1000);
    await click("DEMO: DEFEAT BOSS");
    expect(JSON.parse(localStorage.getItem("ironvale-demo")!).rewards).toContain("Slime Band");
  });
});

describe("progression display consistency", () => {
  it("restores the demo calendar along with the training streak", async () => {
    await mount();
    for (let i = 0; i < 3; i++) await click("Next Training Day");
    expect(host.textContent).toContain("Training streak: 3 days");
    await act(async () => root.unmount()); root = createRoot(host);
    await mount();
    expect(host.textContent).toContain("Training streak: 3 days");
    await click("Next Training Day");
    expect(host.textContent).toContain("Training streak: 4 days");
  });
  it("does not claim a boss is unlocked when its level gate is still unmet", async () => {
    await mount(); await click("BOSS GATE"); await advance(1000);
    await click("FIGHT SLIME"); await advance(600);
    await click("DEMO: DEFEAT BOSS");
    const result = host.querySelector(".result-card")!;
    expect(result.textContent).toContain("LEVEL REQUIRED");
    expect(result.textContent).toContain("Reach Character Level 3");
    expect(result.textContent).not.toContain("BOSS UNLOCKED");
  });
});
