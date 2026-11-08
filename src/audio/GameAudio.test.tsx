import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "./GameAudio";
class FakeAudio extends EventTarget {
  volume = 1; loop = false; preload = ""; paused = true; playbackRate = 1; preservesPitch = true;
  src: string;
  constructor(readonly url: string) { super(); this.src = url; }
  play = vi.fn((): Promise<void> => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
}
let audio: GameAudio, created: FakeAudio[], rejectMusic: boolean;
const environment = { enabled: true, track: "base" as const, duck: 1, suspended: false };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const music = () => created.filter(a => a.url.endsWith(".mp3"));
const playingEffects = () => created.filter(a => a.url.endsWith(".wav") && a.play.mock.calls.length && !a.paused);
beforeEach(() => {
  vi.useFakeTimers(); created = []; rejectMusic = false;
  audio = new GameAudio(url => {
    const element = new FakeAudio(url);
    if (rejectMusic && url.endsWith(".mp3")) { element.play.mockRejectedValueOnce(new Error("Autoplay blocked")); rejectMusic = false; }
    created.push(element); return element as unknown as HTMLAudioElement;
  }, "/preview/");
});
afterEach(() => { audio.dispose(); vi.useRealTimers(); });
describe("game audio playback", () => {
  it("honors a saved mute setting without starting music or effects", () => {
    audio.configure({ ...environment, enabled: false }); audio.unlock(); audio.play("hit");
    expect(created).toHaveLength(0);
  });
  it("loops the full scene track, crossfades scene changes, and never restarts unchanged tracks", async () => {
    audio.configure(environment); audio.unlock(); await settle(); await vi.advanceTimersByTimeAsync(650);
    const base = music()[0];
    expect(base.url).toBe("/preview/audio/music/base.mp3"); expect(base.loop).toBe(true); expect(base.volume).toBeCloseTo(.24);
    audio.configure(environment); audio.unlock(); expect(music()).toHaveLength(1);
    audio.configure({ ...environment, track: "training" }); await settle(); await vi.advanceTimersByTimeAsync(650);
    expect(base.paused).toBe(true); expect(base.src).toBe("");
    expect(music()[1].volume).toBeCloseTo(.24);
  });
  it("ducks music during training or Ultimate without restarting it", async () => {
    audio.configure(environment); audio.unlock(); await settle(); await vi.advanceTimersByTimeAsync(650);
    audio.configure({ ...environment, duck: .18 });
    expect(music()).toHaveLength(1); expect(music()[0].volume).toBeCloseTo(.24*.18);
    audio.configure(environment); expect(music()[0].volume).toBeCloseTo(.24);
  });
  it("recovers from refused autoplay on the next user gesture", async () => {
    rejectMusic = true; audio.configure(environment); audio.unlock(); await settle();
    expect(music()[0].paused).toBe(true);
    audio.unlock(); await settle(); await vi.advanceTimersByTimeAsync(650);
    expect(music()).toHaveLength(2); expect(music()[1].paused).toBe(false);
  });
  it("stops sound immediately on mute and never revives earlier effects", async () => {
    audio.configure(environment); audio.unlock(); await settle(); audio.play("hit"); await settle();
    const hit = playingEffects()[0]; expect(hit).toBeDefined();
    audio.configure({ ...environment, enabled: false });
    expect(music()[0].paused).toBe(true); expect(hit.paused).toBe(true); expect(vi.getTimerCount()).toBe(0);
    audio.configure(environment); await settle(); expect(hit.paused).toBe(true);
  });
  it("stops a hidden tab and resumes only music when visible", async () => {
    audio.configure(environment); audio.unlock(); await settle(); audio.play("charge"); await settle();
    const charge = playingEffects()[0];
    audio.setHidden(true); expect(charge.paused).toBe(true); expect(music()[0].paused).toBe(true);
    audio.play("ultimate"); expect(playingEffects()).toHaveLength(0);
    audio.setHidden(false); await settle(); expect(music()).toHaveLength(2); expect(charge.paused).toBe(true);
  });
  it("limits overlapping effects and rate-limits repeated rep feedback", async () => {
    audio.configure(environment); audio.unlock(); await settle();
    audio.play("rep"); audio.play("rep"); expect(playingEffects()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(150); audio.play("rep"); expect(playingEffects()).toHaveLength(2);
    for (let i=0;i<10;i++) { await vi.advanceTimersByTimeAsync(100); audio.play("hit"); }
    expect(playingEffects()).toHaveLength(6);
    const ended = playingEffects()[0]; ended.paused = true; ended.dispatchEvent(new Event("ended"));
    audio.play("guard"); expect(playingEffects()).toHaveLength(6);
  });
  it("fades battle music out for results while allowing the victory jingle", async () => {
    audio.configure({ ...environment, track: "battle" }); audio.unlock(); await settle();
    audio.configure({ ...environment, track: null }); audio.play("victory"); await settle();
    await vi.advanceTimersByTimeAsync(650);
    expect(music()[0].paused).toBe(true); expect(playingEffects()[0].url).toContain("victory.wav");
  });
  it("cleans up playback and fade timers, including repeated StrictMode setup", async () => {
    audio.configure(environment); audio.unlock(); await settle(); audio.play("charge");
    audio.dispose(); expect(vi.getTimerCount()).toBe(0); expect(playingEffects()).toHaveLength(0);
    audio.configure(environment); audio.unlock(); await settle(); await vi.advanceTimersByTimeAsync(650);
    expect(music().at(-1)!.paused).toBe(false);
  });
});
