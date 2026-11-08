import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { DEFAULT_SAVE, type SaveData } from "./game/progression";
const mocks = vi.hoisted(() => ({ audio: { play: vi.fn() }, save: vi.fn(), cameraProgress: null as null | ((amount: number) => void) }));
vi.mock("./audio/useGameAudio", () => ({ useGameAudio: () => mocks.audio }));
vi.mock("./game/cloudSave", () => ({ saveCloudProgress: mocks.save, SaveConflictError: class extends Error {} }));
vi.mock("./vision/WorkoutCamera", () => ({ default: ({ onProgress }: { onProgress: (amount: number) => void }) => { mocks.cameraProgress = onProgress; return <div data-testid="camera" />; } }));
let root: Root, host: HTMLDivElement;
const defaults = { ...DEFAULT_SAVE, rewards: [] };
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  mocks.audio.play.mockClear();
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
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === text || b.getAttribute("aria-label") === text || b.querySelector("b")?.textContent === text);
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

  it("lets a Free Run exceed the fixed targets and saves prorated XP on manual finish", async () => {
    await mount(defaults);
    await enterGym();
    await act(async () => host.querySelector<HTMLButtonElement>(".treadmill-station")!.click());
    await advance(1000);
    await click("Free Run"); await click("BEGIN"); await click("ENABLE CAMERA");
    await act(async () => mocks.cameraProgress!(95000));
    expect(host.textContent).not.toContain("SESSION COMPLETE");
    await click("FINISH");
    expect(host.querySelector(".xp-earned")?.textContent).toContain("+31 VITALITY XP");
    await act(async () => mocks.cameraProgress!(30000));
    await advance(30000);
    const saved = mocks.save.mock.calls.at(-1)![0] as SaveData;
    expect(saved.healthXp).toBe(31);
    expect(saved.streak).toBe(1);
  });

  it("resets the Free Run countdown on movement and ends after 30 idle seconds", async () => {
    await mount(defaults);
    await enterGym();
    await act(async () => host.querySelector<HTMLButtonElement>(".treadmill-station")!.click());
    await advance(1000);
    await click("Free Run"); await click("BEGIN"); await click("ENABLE CAMERA");
    await advance(10000);
    expect(host.querySelector('[role="timer"]')?.textContent).toContain("20s");
    await act(async () => mocks.cameraProgress!(8000));
    expect(host.querySelector('[role="timer"]')?.textContent).toContain("30s");
    await advance(29999);
    expect(host.querySelector('[role="timer"]')?.textContent).toContain("1s");
    await advance(1);
    expect(host.querySelector(".xp-earned")?.textContent).toContain("+2 VITALITY XP");
    expect(host.textContent).toContain("Free Run ended after 30 seconds of inactivity.");
    expect(host.querySelector('[data-testid="camera"]')).toBeNull();
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
    expect(host.textContent).toContain("Ultimate: 1/3 stacks");
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
    await click("FIGHT SLIME"); await advance(600); await click("Add Ultimate Stack");
    const ultimate = host.querySelector<HTMLButtonElement>('[aria-label^="Ultimate:"]')!;
    expect(ultimate.disabled).toBe(false);
    await act(async () => ultimate.click());
    expect(host.querySelector(".ultimate-fx")).not.toBeNull();
    expect(host.querySelector(".player-fighter .floating-character-progress")).not.toBeNull();
    expect(mocks.audio.play).toHaveBeenCalledWith("charge");
    await advance(900);
    expect(mocks.audio.play).toHaveBeenCalledWith("slash");
    expect(mocks.audio.play).not.toHaveBeenCalledWith("ultimate");
    await advance(300);
    expect(mocks.audio.play).toHaveBeenCalledWith("ultimate");
    expect(mocks.audio.play).toHaveBeenCalledWith("magic");
    await advance(900);
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

describe("game sound integration", () => {
  it("persists mute and keeps the control available inside battles", async () => {
    await mount(); await click("Toggle sound");
    expect(JSON.parse(localStorage.getItem("ironvale-demo")!).sound).toBe(false);
    await click("BOSS GATE"); await advance(1000); await click("FIGHT SLIME"); await advance(600);
    const toggle = host.querySelector<HTMLButtonElement>('[aria-label="Toggle sound"]')!;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.disabled).toBe(false);
  });
  it("plays rep feedback and one level-up jingle when a workout crosses a stat level", async () => {
    await mount({ ...defaults, strengthXp: 90 });
    await enterGym(); await station(".dumbbell-station"); await click("ENABLE CAMERA");
    for (let i=0;i<5;i++) await act(async () => mocks.cameraProgress!(1));
    expect(mocks.audio.play.mock.calls.filter(([effect]) => effect === "rep")).toHaveLength(4);
    expect(mocks.audio.play.mock.calls.filter(([effect]) => effect === "level-up")).toHaveLength(1);
    expect(mocks.audio.play.mock.calls.filter(([effect]) => effect === "complete")).toHaveLength(0);
  });
});

describe("streak-based Ultimate stacks", () => {
  it("is usable immediately at level one, spends one stack, and cannot recharge through Guard", async () => {
    await mount(); await click("BOSS GATE"); await advance(1000); await click("FIGHT SLIME"); await advance(600);
    let button=host.querySelector<HTMLButtonElement>('[aria-label^="Ultimate:"]')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(host.querySelector(".ultimate-fx")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("ironvale-demo")!).ultimateStacks).toBe(0);
    await advance(3200);
    button=host.querySelector<HTMLButtonElement>('[aria-label^="Ultimate:"]')!;
    expect(button.disabled).toBe(true);
    for(let turn=0;turn<3;turn++) { await click("GUARD"); await advance(2000); }
    expect(JSON.parse(localStorage.getItem("ironvale-demo")!).ultimateStacks).toBe(0);
    expect(button.disabled).toBe(true);
  });
  it("awards a stack every three demo training days and never exceeds three", async () => {
    await mount();
    for(let day=1;day<=9;day++) {
      await click("Next Training Day");
      expect(JSON.parse(localStorage.getItem("ironvale-demo")!).ultimateStacks).toBe(Math.min(3,1+Math.floor(day/3)));
    }
    await act(async () => root.unmount()); root=createRoot(host); await mount();
    expect(host.textContent).toContain("Ultimate: 3/3 stacks");
  });
  it("persists one consumed stack to the account save immediately", async () => {
    await mount({ ...defaults, ultimateStacks: 2 });
    await click("BOSS GATE"); await advance(1000); await click("FIGHT SLIME"); await advance(600);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label^="Ultimate:"]')!.click());
    expect((mocks.save.mock.calls.at(-1)![0] as SaveData).ultimateStacks).toBe(1);
  });
});
