import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGameAudio } from "./useGameAudio";
class FakeAudio extends EventTarget {
  static all: FakeAudio[] = [];
  src: string; paused = true; loop = false; preload = ""; volume = 1; playbackRate = 1; preservesPitch = true;
  constructor(readonly url: string) { super(); this.src = url; FakeAudio.all.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
}
function Harness({ enabled = true }: { enabled?: boolean }) {
  const audio = useGameAudio(enabled, "base", 1, false);
  return <button onClick={() => audio.play("rep")}>Rep</button>;
}
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal("Audio", FakeAudio); FakeAudio.all = [];
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("connects gestures, menu effects and saved mute without duplicating the scene track", async () => {
  await act(async () => root.render(<Harness />));
  await act(async () => {
    document.dispatchEvent(new Event("pointerdown"));
    host.querySelector("button")!.click();
  });
  expect(FakeAudio.all.filter(a => a.url.endsWith("base.mp3"))).toHaveLength(1);
  expect(FakeAudio.all.some(a => a.url.endsWith("rep.wav") && !a.paused)).toBe(true);
  expect(FakeAudio.all.some(a => a.url.endsWith("click.wav") && !a.paused)).toBe(true);
  await act(async () => root.render(<Harness enabled={false} />));
  expect(FakeAudio.all.every(a => a.paused)).toBe(true);
});
it("cleans up StrictMode playback and listeners when leaving the game", async () => {
  await act(async () => root.render(<StrictMode><Harness /></StrictMode>));
  await act(async () => vi.advanceTimersByTimeAsync(650));
  expect(FakeAudio.all.filter(a => a.url.endsWith("base.mp3") && !a.paused)).toHaveLength(1);
  await act(async () => root.unmount()); root = createRoot(host);
  const count = FakeAudio.all.length;
  document.dispatchEvent(new Event("pointerdown"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(FakeAudio.all).toHaveLength(count);
  expect(FakeAudio.all.every(a => a.paused)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
