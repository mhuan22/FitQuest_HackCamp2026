export type MusicTrack = "base" | "training" | "battle" | "dark-battle";
export type SoundEffect = "click" | "rep" | "charge" | "guard" | "hit" | "heavy" | "magic" | "hurt" | "victory" | "level-up" | "complete" | "defeat" | "slash" | "ultimate";
type Environment = { enabled: boolean; track: MusicTrack | null; duck: number; suspended: boolean };
type MusicVoice = { track: MusicTrack; element: HTMLAudioElement; gain: number };
const MUSIC_VOLUME = 0.24;
const effectFile = (effect: SoundEffect) => effect === "slash" ? "guard" : effect === "ultimate" ? "heavy" : effect;
const effectVolume: Partial<Record<SoundEffect, number>> = { click: 0.2, rep: 0.36, charge: 0.35, guard: 0.45, heavy: 0.55, magic: 0.4, hurt: 0.45, slash: 0.28, ultimate: 0.65 };

/** One playback owner per mounted game. Rejected playback never interrupts play. */
export class GameAudio {
  private environment: Environment = { enabled: false, track: null, duck: 1, suspended: false };
  private unlocked = false;
  private hidden = false;
  private disposed = false;
  private generation = 0;
  private active: MusicVoice | null = null;
  private music = new Set<MusicVoice>();
  private effects = new Set<HTMLAudioElement>();
  private fades = new Map<MusicVoice, ReturnType<typeof setInterval>>();
  private recent = new Map<SoundEffect, number>();
  private preloads = new Map<string, HTMLAudioElement>();

  constructor(private create: (url: string) => HTMLAudioElement = url => new Audio(url), private base = import.meta.env.BASE_URL) {}
  private get audible() { return !this.disposed && this.environment.enabled && !this.environment.suspended && !this.hidden; }
  private url(path: string) { return `${this.base}audio/${path}`; }

  configure(environment: Environment) {
    this.disposed = false; // React StrictMode can replay setup after cleanup.
    this.environment = environment;
    if (!this.audible) { this.stopAll(); return; }
    for (const voice of this.music) this.applyVolume(voice);
    this.syncMusic();
  }
  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (this.audible) { this.preloadEffects(); this.syncMusic(); }
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) this.stopAll(); else this.syncMusic();
  }
  private applyVolume(voice: MusicVoice) {
    voice.element.volume = Math.max(0, Math.min(1, MUSIC_VOLUME * this.environment.duck * voice.gain));
  }
  private retire(voice: MusicVoice) {
    const timer = this.fades.get(voice);
    if (timer !== undefined) clearInterval(timer);
    this.fades.delete(voice);
    voice.element.pause();
    voice.element.removeAttribute("src");
    voice.element.load();
    this.music.delete(voice);
    if (this.active === voice) this.active = null;
  }
  private fade(voice: MusicVoice, target: number) {
    const previous = this.fades.get(voice);
    if (previous !== undefined) clearInterval(previous);
    const start = Date.now(), from = voice.gain;
    const timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / 600);
      voice.gain = from + (target - from) * progress;
      this.applyVolume(voice);
      if (progress === 1) {
        clearInterval(timer); this.fades.delete(voice);
        if (target === 0) this.retire(voice);
      }
    }, 30);
    this.fades.set(voice, timer);
  }
  private syncMusic() {
    if (!this.audible || !this.unlocked) return;
    const track = this.environment.track;
    if (track === this.active?.track) return;
    const generation = ++this.generation;
    if (!track) {
      this.active = null;
      for (const voice of this.music) this.fade(voice, 0);
      return;
    }
    const element = this.create(this.url(`music/${track}.mp3`));
    element.loop = true; element.preload = "auto"; element.volume = 0;
    const voice = { track, element, gain: 0 };
    this.active = voice; this.music.add(voice);
    void element.play().then(() => {
      if (generation !== this.generation || !this.audible) { this.retire(voice); return; }
      this.fade(voice, 1);
      for (const other of this.music) if (other !== voice) this.fade(other, 0);
    }).catch(() => {
      this.retire(voice);
      if (generation === this.generation) {
        this.unlocked = false;
        for (const other of [...this.music]) this.retire(other);
      }
    });
  }
  private preloadEffects() {
    const names: SoundEffect[] = ["click", "rep", "charge", "guard", "hit", "heavy", "magic", "hurt", "victory", "level-up", "complete", "defeat"];
    for (const name of names) {
      if (this.preloads.has(name)) continue;
      const element = this.create(this.url(`effects/${effectFile(name)}.wav`));
      element.preload = "auto"; element.load();
      this.preloads.set(name, element);
    }
  }
  play(effect: SoundEffect, rate = 1) {
    if (!this.audible || !this.unlocked) return;
    const now = Date.now();
    const cooldown = effect === "rep" ? 140 : effect === "click" ? 55 : 90;
    if (now - (this.recent.get(effect) ?? -Infinity) < cooldown) return;
    this.recent.set(effect, now);
    if (this.effects.size >= 6) {
      const oldest = this.effects.values().next().value;
      if (oldest) { oldest.pause(); this.effects.delete(oldest); }
    }
    const generation = this.generation;
    const element = this.create(this.url(`effects/${effectFile(effect)}.wav`));
    element.volume = effectVolume[effect] ?? 0.45;
    element.playbackRate = rate;
    element.preservesPitch = false;
    this.effects.add(element);
    const release = () => this.effects.delete(element);
    element.addEventListener("ended", release, { once: true });
    element.addEventListener("error", release, { once: true });
    void element.play().then(() => {
      if (generation !== this.generation || !this.audible) { element.pause(); release(); }
    }).catch(() => { element.pause(); release(); });
  }
  private stopAll() {
    ++this.generation;
    for (const voice of [...this.music]) this.retire(voice);
    for (const element of this.effects) element.pause();
    this.effects.clear(); this.recent.clear();
  }
  dispose() {
    this.disposed = true;
    this.stopAll();
    for (const element of this.preloads.values()) { element.removeAttribute("src"); element.load(); }
    this.preloads.clear();
  }
}
