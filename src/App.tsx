import { useGameAudio } from "./audio/useGameAudio";
import { BOSS_REQUIREMENTS, bossLockReason, raiseDemoLevel, unlockDemoBoss, type BossKey } from "./game/bossAccess";
import { UltimateEffect } from "./UltimateEffect";
import { ULTIMATE } from "./game/ultimate";
import { useAnimationFrame } from "./game/useAnimationFrame";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "./game/useProgress";
import { archiveRecovery } from "./game/saveRecovery";
import { DEFAULT_SAVE, currentStreak, xpProgress, characterLevel, characterXpProgress, consumeUltimate, daysUntilUltimate, MAX_ULTIMATE_STACKS, trainingDay, nextDemoTrainingDay, levelFromXp, levelProgress, STAT_INFO, type SaveData } from "./game/progression";
import { FREE_RUN_IDLE_MS, RUN_BLOCK_SECONDS, STATIONS, XP_PER_UNIT, freeRunXp, type CharacterAction, type StationKey } from "./training/stations";
import { clearDemoWorkouts, useGuildTraining } from "./training/guildTraining";
import { GuildTrainingReport } from "./training/GuildTrainingReport";
import WorkoutCamera from "./vision/WorkoutCamera";
import { exercises } from "./vision/repCounter";
import golemIdleA from "./assets/bosses/golem/idle-a.png";
import golemIdleB from "./assets/bosses/golem/idle-b.png";
import owlIdleA from "./assets/bosses/owl/idle-a.png";
import owlIdleB from "./assets/bosses/owl/idle-b.png";
import slimeIdleA from "./assets/bosses/slime-idle-a.png";
import slimeIdleB from "./assets/bosses/slime-idle-b.png";
import model1A from "./assets/characters/idle/model-01-a.png";
import model1B from "./assets/characters/idle/model-01-b.png";
import modelBack1A from "./assets/characters/idle/back/model-01-a.png";
import modelBack1B from "./assets/characters/idle/back/model-01-b.png";
import model2A from "./assets/characters/idle/model-02-a.png";
import model2B from "./assets/characters/idle/model-02-b.png";
import modelBack2A from "./assets/characters/idle/back/model-02-a.png";
import modelBack2B from "./assets/characters/idle/back/model-02-b.png";
import model3A from "./assets/characters/idle/model-03-a.png";
import model3B from "./assets/characters/idle/model-03-b.png";
import modelBack3A from "./assets/characters/idle/back/model-03-a.png";
import modelBack3B from "./assets/characters/idle/back/model-03-b.png";
import model4A from "./assets/characters/idle/model-04-a.png";
import model4B from "./assets/characters/idle/model-04-b.png";
import modelBack4A from "./assets/characters/idle/back/model-04-a.png";
import modelBack4B from "./assets/characters/idle/back/model-04-b.png";
import model5A from "./assets/characters/idle/model-05-a.png";
import model5B from "./assets/characters/idle/model-05-b.png";
import modelBack5A from "./assets/characters/idle/back/model-05-a.png";
import modelBack5B from "./assets/characters/idle/back/model-05-b.png";
import model6A from "./assets/characters/idle/model-06-a.png";
import model6B from "./assets/characters/idle/model-06-b.png";
import modelBack6A from "./assets/characters/idle/back/model-06-a.png";
import modelBack6B from "./assets/characters/idle/back/model-06-b.png";

type Scene = "base" | "gym" | "battle";
const BOSSES = {
  slime: {
    name: "TRAINING SLIME",
    hp: 50,
    attack: 8,
    intro: "The Training Slime jiggles into your path!",
  },
  golem: {
    name: "STONE GOLEM",
    hp: 100,
    attack: 12,
    intro: "The Stone Golem awakens and blocks your path!",
  },
  owl: {
    name: "FROST OWL",
    hp: 90,
    attack: 11,
    intro: "The Frost Owl descends in a storm of crystal feathers!",
  },
  shellback: {
    name: "ANCIENT SHELLBACK",
    hp: 120,
    attack: 10,
    intro: "The Ancient Shellback rises from the mire for the final trial!",
  },
} satisfies Record<BossKey, { name: string; hp: number; attack: number; intro: string }>;

// Each character model has two idle and two walking frames per direction.
const CHARACTER_MODELS = [
  [model1A, model1B],
  [model2A, model2B],
  [model3A, model3B],
  [model4A, model4B],
  [model5A, model5B],
  [model6A, model6B],
];

const BACK_MODELS = [
  [modelBack1A, modelBack1B],
  [modelBack2A, modelBack2B],
  [modelBack3A, modelBack3B],
  [modelBack4A, modelBack4B],
  [modelBack5A, modelBack5B],
  [modelBack6A, modelBack6B],
];

const WALK_FILES = import.meta.glob("./assets/characters/walk/front/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const WALK_MODELS = Array.from({ length: 6 }, (_, index) => {
  const model = String(index + 1).padStart(2, "0");
  return ["a", "b"].map(
    (state) => WALK_FILES[`./assets/characters/walk/front/model-${model}-${state}.png`],
  );
});

const BACK_WALK_FILES = import.meta.glob("./assets/characters/walk/back/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const BACK_WALK_MODELS = Array.from({ length: 6 }, (_, index) => {
  const model = String(index + 1).padStart(2, "0");
  return ["a", "b"].map(
    (state) => BACK_WALK_FILES[`./assets/characters/walk/back/model-${model}-${state}.png`],
  );
});

const ATTACK_FILES = import.meta.glob("./assets/characters/attack/model-*/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const ATTACK_MODELS = Array.from({ length: 6 }, (_, index) => {
  const model = String(index + 1).padStart(2, "0");
  return Array.from(
    { length: 8 },
    (_, frame) =>
      ATTACK_FILES[
        `./assets/characters/attack/model-${model}/frame-${String(frame + 1).padStart(2, "0")}.png`
      ],
  );
});

const SLIME_ATTACK_FILES = import.meta.glob("./assets/bosses/attacks/pattern-*/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const SLIME_ATTACK_PATTERNS = [7, 5, 6].map((frameCount, patternIndex) =>
  Array.from(
    { length: frameCount },
    (_, frameIndex) =>
      SLIME_ATTACK_FILES[
        `./assets/bosses/attacks/pattern-${patternIndex + 1}/frame-${String(
          frameIndex + 1,
        ).padStart(2, "0")}.png`
      ],
  ),
);

const GOLEM_ATTACK_FILES = import.meta.glob("./assets/bosses/golem/attack/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const GOLEM_ATTACK_FRAMES = Array.from(
  { length: 6 },
  (_, frameIndex) =>
    GOLEM_ATTACK_FILES[
      `./assets/bosses/golem/attack/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const GOLEM_THROW_FILES = import.meta.glob("./assets/bosses/golem/attack-throw/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const GOLEM_THROW_FRAMES = Array.from(
  { length: 6 },
  (_, frameIndex) =>
    GOLEM_THROW_FILES[
      `./assets/bosses/golem/attack-throw/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const GOLEM_BASH_FILES = import.meta.glob("./assets/bosses/golem/attack-bash/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const GOLEM_BASH_FRAMES = Array.from(
  { length: 5 },
  (_, frameIndex) =>
    GOLEM_BASH_FILES[
      `./assets/bosses/golem/attack-bash/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const OWL_ATTACK_FILES = import.meta.glob("./assets/bosses/owl/attack/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const OWL_ATTACK_FRAMES = Array.from(
  { length: 8 },
  (_, frameIndex) =>
    OWL_ATTACK_FILES[
      `./assets/bosses/owl/attack/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const OWL_SWOOP_FILES = import.meta.glob("./assets/bosses/owl/attack-swoop/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const OWL_SWOOP_FRAMES = Array.from(
  { length: 9 },
  (_, frameIndex) =>
    OWL_SWOOP_FILES[
      `./assets/bosses/owl/attack-swoop/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const SHELLBACK_FILES = import.meta.glob("./assets/bosses/shellback/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const SHELLBACK_FRAMES = Array.from(
  { length: 4 },
  (_, frameIndex) =>
    SHELLBACK_FILES[
      `./assets/bosses/shellback/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const SHELLBACK_ROLL_FILES = import.meta.glob("./assets/bosses/shellback/attack-roll/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const SHELLBACK_ROLL_FRAMES = Array.from(
  { length: 10 },
  (_, frameIndex) =>
    SHELLBACK_ROLL_FILES[
      `./assets/bosses/shellback/attack-roll/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const SHELLBACK_SLAM_FILES = import.meta.glob("./assets/bosses/shellback/attack-slam/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const SHELLBACK_SLAM_FRAMES = Array.from(
  { length: 10 },
  (_, frameIndex) =>
    SHELLBACK_SLAM_FILES[
      `./assets/bosses/shellback/attack-slam/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const SHELLBACK_IMPACT_FILES = import.meta.glob("./assets/bosses/shellback/attack-impact/*.png", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const SHELLBACK_IMPACT_FRAMES = Array.from(
  { length: 9 },
  (_, frameIndex) =>
    SHELLBACK_IMPACT_FILES[
      `./assets/bosses/shellback/attack-impact/frame-${String(frameIndex + 1).padStart(2, "0")}.png`
    ],
);

const PLAYER_ATTACK_MS = 800;
const WALK_MS = 900;

function bossAttackTiming(boss: BossKey, count: number) {
  const pattern = boss === "owl" ? (count + 1) % 2 : (count + 2) % 3;
  const frames = boss === "slime" ? SLIME_ATTACK_PATTERNS[pattern]
    : boss === "golem" ? [GOLEM_ATTACK_FRAMES, GOLEM_THROW_FRAMES, GOLEM_BASH_FRAMES][pattern]
    : boss === "owl" ? [OWL_ATTACK_FRAMES, OWL_SWOOP_FRAMES][pattern]
    : [SHELLBACK_ROLL_FRAMES, SHELLBACK_SLAM_FRAMES, SHELLBACK_IMPACT_FRAMES][pattern];
  const interval = boss === "slime" ? 105 : boss === "golem" ? 115
    : boss === "owl" ? (pattern === 0 ? 95 : 90) : (pattern === 2 ? 86 : 78);
  // Hit at the strike pose; retain the remaining frames for recovery.
  const impactFrame = boss === "slime" ? [4, 2, 3][pattern]
    : boss === "golem" ? [3, 4, 3][pattern]
    : boss === "owl" ? [4, 6][pattern] : [4, 5, 3][pattern];
  return { duration: frames.length * interval, impact: impactFrame * interval };
}


function SlimeSprite({
  className = "",
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  const frame = useAnimationFrame(animate, 520);
  return (
    <img
      className={`slime-sprite ${className}`}
      src={frame === 0 ? slimeIdleA : slimeIdleB}
      alt="Training Slime"
    />
  );
}

function GolemSprite({
  className = "",
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  const frame = useAnimationFrame(animate, 620);
  return (
    <img
      className={`golem-sprite ${className}`}
      src={frame === 0 ? golemIdleA : golemIdleB}
      alt="Stone Golem"
    />
  );
}

function OwlSprite({ className = "", animate = true }: { className?: string; animate?: boolean }) {
  const frame = useAnimationFrame(animate, 420);
  return (
    <img
      className={`owl-sprite ${className}`}
      src={frame === 0 ? owlIdleA : owlIdleB}
      alt="Frost Owl"
    />
  );
}

function ShellbackSprite({
  className = "",
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  const frame = useAnimationFrame(animate, 180, SHELLBACK_FRAMES.length);
  return (
    <img
      className={`shellback-sprite ${className}`}
      src={SHELLBACK_FRAMES[frame]}
      alt="Ancient Shellback"
    />
  );
}

function ShellbackAttackSprite({ pattern }: { pattern: number }) {
  const frames =
    pattern === 0
      ? SHELLBACK_ROLL_FRAMES
      : pattern === 1
        ? SHELLBACK_SLAM_FRAMES
        : SHELLBACK_IMPACT_FRAMES;
  const frame = useAnimationFrame(true, pattern === 2 ? 86 : 78, frames.length, false);
  return (
    <img
      className={`shellback-attack-sprite shellback-attack-pattern-${
        pattern + 1
      } shellback-attack-frame-${frame + 1}`}
      src={frames[frame]}
      alt="Ancient Shellback attacking"
    />
  );
}

function OwlAttackSprite({ pattern }: { pattern: number }) {
  const frames = pattern === 0 ? OWL_ATTACK_FRAMES : OWL_SWOOP_FRAMES;
  const frame = useAnimationFrame(true, pattern === 0 ? 95 : 90, frames.length, false);
  return (
    <img
      className={`owl-attack-sprite owl-attack-pattern-${pattern + 1} owl-attack-frame-${frame + 1}`}
      src={frames[frame]}
      alt="Frost Owl attacking"
    />
  );
}

function GolemAttackSprite({ pattern }: { pattern: number }) {
  const frames =
    pattern === 0 ? GOLEM_ATTACK_FRAMES : pattern === 1 ? GOLEM_THROW_FRAMES : GOLEM_BASH_FRAMES;
  const frame = useAnimationFrame(true, 115, frames.length, false);
  return (
    <img
      className={`golem-attack-sprite golem-attack-pattern-${pattern + 1} golem-attack-frame-${
        frame + 1
      }`}
      src={frames[frame]}
      alt="Stone Golem attacking"
    />
  );
}

function SlimeAttackSprite({ pattern }: { pattern: number }) {
  const frames = SLIME_ATTACK_PATTERNS[pattern % SLIME_ATTACK_PATTERNS.length];
  const frame = useAnimationFrame(true, 105, frames.length, false);

  return (
    <span className="combat-slime slime-attack-motion">
      <img
        className={`slime-attack-sprite slime-pattern-${pattern + 1} slime-frame-${frame + 1}`}
        src={frames[frame]}
        alt="Training Slime attacking"
      />
    </span>
  );
}

function PixelIcon({ type }: { type: "sound" | "settings" | "pause" | "camera" }) {
  if (type === "sound") {
    return (
      <svg className="pixel-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9h4l5-4v14l-5-4H3V9Z" />
        <path d="M16 8c1.5 1.1 2 2.3 2 4s-.5 2.9-2 4M19 5c2.2 1.9 3 4 3 7s-.8 5.2-3 7" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg className="pixel-svg gear-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3h6l1 3 3-1 3 5-2 2 2 2-3 5-3-1-1 3H9l-1-3-3 1-3-5 2-2-2-2 3-5 3 1 1-3Z" />
        <rect x="9" y="9" width="6" height="6" />
      </svg>
    );
  }
  if (type === "pause") {
    return (
      <span className="icon-pause">
        <i />
        <i />
      </span>
    );
  }
  return (
    <span className="icon-camera">
      <i />
    </span>
  );
}

function Character({
  skin = 0,
  action = "idle",
  className = "",
  facing = "left",
}: {
  skin?: number;
  action?: CharacterAction;
  className?: string;
  facing?: "left" | "right" | "back";
}) {
  const levels =
    action === "attack"
      ? ATTACK_MODELS
      : action === "walk"
        ? facing === "back"
          ? BACK_WALK_MODELS
          : WALK_MODELS
        : facing === "back"
          ? BACK_MODELS
          : CHARACTER_MODELS;
  const frames = levels[skin % levels.length];
  const frame = useAnimationFrame(
    action === "idle" || action === "walk" || action === "attack",
    action === "attack" ? PLAYER_ATTACK_MS / frames.length : action === "walk" ? 180 : 520,
    frames.length,
    action !== "attack",
    `${action}:${facing}:${skin}`,
  );
  return (
    <img
      className={`back-sprite action-${action} facing-${facing} ${className}`}
      src={frames[frame]}
      alt="Player character"
    />
  );
}

function StatBar({ label, xp }: { label: string; xp: number }) {
  const level = levelFromXp(xp);
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong>LV {level}</strong>
      <div className="xp-track" aria-label={`${label} experience ${xpProgress(xp).earned} of ${xpProgress(xp).required}`}>
        <i style={{ width: `${levelProgress(xp)}%` }} />
      </div>
    </div>
  );
}

function Frame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pixel-frame ${className}`}>
      {title && <div className="frame-title">{title}</div>}
      {children}
    </div>
  );
}

type GameProps = {
  userId?: string;
  username?: string;
  initialSave?: SaveData;
  initialRevision?: number;
  onLogout: () => Promise<void>;
  onReload: () => void;
  accountError?: string;
  demoMode?: boolean;
  onDemoModeChange?: (enabled: boolean) => void;
};

export default function App({ userId, username, initialSave, initialRevision = 0, onLogout, onReload, accountError, demoMode = false, onDemoModeChange }: GameProps) {
  const demo = demoMode || (!userId && (import.meta.env.DEV || new URLSearchParams(location.search).has("demo")));
  const storageKey = demo ? "ironvale-demo" : "ironvale-save";
  const sessionStartXp = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const turnLocked = useRef(false);
  const travelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function later(callback: () => void, ms: number) { timers.current.push(setTimeout(callback, ms)); }
  function clearTimers() { if (travelTimer.current !== null) clearTimeout(travelTimer.current); timers.current.forEach(clearTimeout); timers.current = []; turnLocked.current = false; }
  useEffect(() => () => clearTimers(), []);
  const [demoDate, setDemoDate] = useState(() => {
    const today = new Date();
    if (!demo) return today;
    try {
      const stored = localStorage.getItem("ironvale-demo-date");
      if (stored) {
        const date = new Date(stored);
        if (Number.isFinite(date.getTime())) return date;
      }
      // Older demo saves recorded training days without recording the test clock.
      const previous = JSON.parse(localStorage.getItem("ironvale-demo") || "null");
      const last = new Date(`${previous?.lastTrainingDate}T12:00:00`);
      return last > today ? last : today;
    } catch { return today; }
  });
  useEffect(() => {
    if (demo) { try { localStorage.setItem("ironvale-demo-date", demoDate.toISOString()); } catch { /* Gameplay saves report storage failures separately. */ } }
  }, [demo, demoDate]);
  const { save, setSave, status: saveStatus, error: saveError, blocked: saveBlocked, retry } = useProgress(userId, initialSave, initialRevision, storageKey);
  const [conflictRecoveryError, setConflictRecoveryError] = useState("");
  const recoveringConflict = useRef(false);
  const recoverConflict = useCallback(() => {
    if (!userId || recoveringConflict.current) return;
    try {
      archiveRecovery(userId);
      recoveringConflict.current = true;
      setConflictRecoveryError("");
      onReload();
    } catch {
      setConflictRecoveryError("Unable to back up your local progress. Free some browser storage, then retry loading the cloud save.");
    }
  }, [userId, onReload]);
  useEffect(() => {
    if (saveStatus === "conflict") recoverConflict();
  }, [saveStatus, recoverConflict]);
  const { record: recordWorkout, sync: syncWorkouts, syncError: workoutSyncError } = useGuildTraining(userId, demo);
  const [loggingOut, setLoggingOut] = useState(false);
  const [scene, setScene] = useState<Scene>("base");
  const [modal, setModal] = useState<"station" | "boss" | "stats" | "guild" | null>(null);
  const [selected, setSelected] = useState<StationKey>("curls");
  const [repTarget, setRepTarget] = useState(5);
  const [runTarget, setRunTarget] = useState<number | "free">(RUN_BLOCK_SECONDS);
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 64 });
  const [moving, setMoving] = useState(false);
  const [worldFacing, setWorldFacing] = useState<"left" | "right" | "back">("left");
  const [hint, setHint] = useState("Choose a destination to begin your training.");
  const [transition, setTransition] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [progress, setProgress] = useState(0);
  const sessionProgress = useRef(0);
  const freeRunDeadline = useRef<number | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(FREE_RUN_IDLE_MS / 1000);
  const [feedback, setFeedback] = useState("Complete the movement.");
  const [paused, setPaused] = useState(false);
  const [reward, setReward] = useState<{ xp: number; leveled: boolean; inactive?: boolean } | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [battle, setBattle] = useState({
    boss: "slime" as BossKey,
    playerHp: 100,
    bossHp: 50,
    turn: 0,
    message: "The Training Slime jiggles into your path!",
    action: "idle" as "idle" | "attack" | "guard" | "hit",
    bossAction: "idle" as "idle" | "attack" | "hit",
    ultimate: false,
    bossAttackCount: 0,
    busy: false,
    opening: false,
    heavyReady: false,
    guarding: false,
    result: null as "victory" | "defeat" | null,
  });

  const skin = Math.min(5, Math.floor((characterLevel(save)-1)/2));
  const strength = levelFromXp(save.strengthXp);
  const agility = levelFromXp(save.agilityXp);
  const defense = levelFromXp(save.defenseXp);
  const vitality = levelFromXp(save.healthXp);
  const maxHealth = 100 + (vitality - 1) * 15;
  const activeStation = STATIONS[selected];
  const timed = activeStation.tracking === "run";
  const target = timed ? runTarget : repTarget;
  const freeRun = target === "free";
  const goal = freeRun ? Infinity : timed ? target * 1000 : target;
  const shownProgress = timed ? Math.floor(progress / 1000) : progress;
  const xpEarned = freeRun ? freeRunXp(progress)
    : (timed ? Math.floor(shownProgress / RUN_BLOCK_SECONDS) : progress) * XP_PER_UNIT;
  const selectedStat = activeStation.stat;
  const activeStatInfo = STAT_INFO[selectedStat];
  const daysToUltimate = daysUntilUltimate(save, demo ? demoDate : new Date());
  const ultimateStatus = save.ultimateStacks === 0
    ? `No stacks · train ${daysToUltimate} more consecutive day${daysToUltimate === 1 ? "" : "s"}`
    : battle.busy ? `${save.ultimateStacks}/3 stacks · ready after this animation` : `${save.ultimateStacks}/3 stacks · uses one stack`;
  const characterXp = characterXpProgress(save);
  const streakDays = currentStreak(save, demo ? demoDate : new Date());
  const activeXp = save[activeStatInfo.xpKey];
  const activeLevel = levelFromXp(activeXp);
  const golemUnlocked = !bossLockReason(save, "golem");
  const owlUnlocked = !bossLockReason(save, "owl");
  const shellbackUnlocked = !bossLockReason(save, "shellback");
  const featuredBoss: BossKey = !save.rewards.includes("Slime Band")
    ? "slime"
    : !save.rewards.includes("Golem Crest")
      ? "golem"
      : !save.rewards.includes("Frost Feather")
        ? "owl"
        : "shellback";
  const activeBoss = BOSSES[battle.boss];
  const nextBoss = ({ slime: "golem", golem: "owl", owl: "shellback", shellback: null } as const)[battle.boss];
  const nextBossLocked = nextBoss ? bossLockReason(save, nextBoss) : "";
  const golemAttackPattern = (battle.bossAttackCount + 2) % 3;
  const owlAttackPattern = (battle.bossAttackCount + 1) % 2;
  const shellbackAttackPattern = (battle.bossAttackCount + 2) % 3;
  const music = scene === "battle" ? battle.result ? null : battle.boss === "golem" || battle.boss === "shellback" ? "dark-battle" : "battle" : scene === "gym" ? "training" : "base";
  const [volume, setVolume] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("ironvale-volume") ?? 100);
      return Number.isInteger(stored) && stored >= 0 && stored <= 100 ? stored : 100;
    } catch { return 100; }
  });
  const audio = useGameAudio(save.sound, music, battle.ultimate ? 0.18 : exercise ? 0.55 : 1, (exercise && paused) || saveBlocked || loggingOut, volume / 100);
  useEffect(() => {
    if (scene === "battle" && battle.result) audio.play(battle.result === "victory" ? "victory" : "defeat");
  }, [audio, scene, battle.result]);
  useEffect(() => {
    if (reward) audio.play(reward.leveled ? "level-up" : "complete");
  }, [audio, reward]);



  function changeScene(next: Scene) {
    if (travelTimer.current !== null) clearTimeout(travelTimer.current);
    setMoving(false);
    setTransition(true);
    later(() => {
      setScene(next);
      setModal(null);
      setWorldFacing("left");
      setPlayerPos({ x: 50, y: next === "gym" ? 70 : 64 });
      setHint(
        next === "gym"
          ? "Choose a station, or return to the base."
          : "Choose a destination to begin your training.",
      );
      later(() => setTransition(false), 250);
    }, 250);
  }

  function travel(x: number, y: number, onArrive: () => void, travelHint: string) {
    if (moving && x === playerPos.x && y === playerPos.y) return;
    if (travelTimer.current !== null) clearTimeout(travelTimer.current);
    setHint(travelHint);
    if (scene !== "battle") {
      setWorldFacing(y < playerPos.y ? "back" : x > playerPos.x ? "right" : "left");
    }
    setMoving(true);
    setPlayerPos({ x, y });
    travelTimer.current = setTimeout(() => {
      travelTimer.current = null;
      setMoving(false);
      onArrive();
    }, x === playerPos.x && y === playerPos.y ? 0 : WALK_MS);
  }

  function openStation(station: StationKey) {
    const { position } = STATIONS[station];
    travel(
      position.x,
      position.y,
      () => {
        setSelected(station);
        setModal("station");
        setHint(
          station === "treadmill"
            ? `Treadmill Run: +${XP_PER_UNIT} XP per ${RUN_BLOCK_SECONDS} active seconds.`
            : `${STATIONS[station].exercise}: +${XP_PER_UNIT} XP per rep.`,
        );
      },
      `Walking to the ${STATIONS[station].name}...`,
    );
  }

  function startExercise() {
    setModal(null);
    sessionStartXp.current = activeXp;
    sessionProgress.current = 0;
    freeRunDeadline.current = freeRun ? Date.now() + FREE_RUN_IDLE_MS : null;
    setIdleSeconds(FREE_RUN_IDLE_MS / 1000);
    setProgress(0);
    setFeedback(exercises[activeStation.tracking].frame);
    setPaused(false);
    setReward(null);
    setCameraError("");
    setExercise(true);
  }

  const completeFreeRun = useCallback((inactive: boolean) => {
    if (freeRunDeadline.current === null) return;
    freeRunDeadline.current = null;
    const gained = freeRunXp(sessionProgress.current);
    recordWorkout("treadmill", sessionProgress.current, gained);
    if (gained > 0) setSave(current => trainingDay(current, demo ? demoDate : new Date()));
    setPaused(false);
    setReward({ xp: gained, leveled: levelFromXp(sessionStartXp.current + gained) > levelFromXp(sessionStartXp.current), inactive });
  }, [setSave, demo, demoDate, recordWorkout]);

  useEffect(() => {
    if (!exercise || !freeRun || reward || saveBlocked || loggingOut) return;
    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      if (freeRunDeadline.current === null) return;
      const remaining = freeRunDeadline.current - Date.now();
      if (remaining <= 0) {
        completeFreeRun(true);
        return;
      }
      setIdleSeconds(Math.ceil(remaining / 1000));
      timeout = setTimeout(tick, remaining % 1000 || 1000);
    }
    tick();
    return () => clearTimeout(timeout);
  }, [exercise, freeRun, reward, saveBlocked, loggingOut, completeFreeRun]);

  const addProgress = useCallback((amount: number) => {
    if (saveBlocked || loggingOut || !exercise || paused || reward || !Number.isFinite(amount) || amount <= 0 || sessionProgress.current >= goal) return;
    if (freeRun) {
      if (freeRunDeadline.current === null) return;
      const now = Date.now();
      if (now >= freeRunDeadline.current) {
        completeFreeRun(true);
        return;
      }
      freeRunDeadline.current = now + FREE_RUN_IDLE_MS;
      setIdleSeconds(FREE_RUN_IDLE_MS / 1000);
    }
    const previous = sessionProgress.current;
    const next = Math.min(goal, previous + amount);
    sessionProgress.current = next;
    setProgress(timed ? Math.floor(next / 1000) * 1000 : next);
    const units = timed ? Math.floor(next / (RUN_BLOCK_SECONDS * 1000))-Math.floor(previous / (RUN_BLOCK_SECONDS * 1000)) : next-previous;
    if (units > 0 && next < goal) audio.play("rep");
    const earned = freeRun ? freeRunXp(next) - freeRunXp(previous) : units * XP_PER_UNIT;
    if (earned > 0) setSave(current => ({...current, [activeStatInfo.xpKey]:current[activeStatInfo.xpKey]+earned}));
    if (next === goal) {
      const gained = (timed ? goal / (RUN_BLOCK_SECONDS * 1000) : goal) * XP_PER_UNIT;
      recordWorkout(selected, next, gained);
      setSave(current => trainingDay(current, demo ? demoDate : new Date()));
      setReward({ xp: gained, leveled: levelFromXp(sessionStartXp.current + gained) > levelFromXp(sessionStartXp.current) });
    }
  }, [goal, timed, freeRun, completeFreeRun, activeStatInfo.xpKey, exercise, paused, reward, demo, demoDate, saveBlocked, loggingOut, audio, setSave, selected, recordWorkout]);

  const progressHandler = useRef(addProgress);
  progressHandler.current = addProgress;
  const stableProgress = useCallback((amount: number) => progressHandler.current(amount), []);
  const onCameraReady = useCallback(() => setCameraReady(true), []);
  const onCameraError = useCallback((message: string) => {
    setCameraEnabled(false);
    setCameraReady(false);
    setCameraError(message);
    setFeedback(message);
  }, []);

  function finishExercise() {
    if (freeRun && !reward) {
      completeFreeRun(false);
      return;
    }
    setCameraEnabled(false);
    setCameraReady(false);
    setExercise(false);
    setReward(null);
    setHint(reward ? "Training complete. Your progress has been saved." : "Training ended.");
  }

  function beginBattle(boss: BossKey = "slime") {
    const locked = bossLockReason(save, boss);
    if (locked) { setHint(locked); return; }
    const bossConfig = BOSSES[boss];
    setBattle({
      boss,
      playerHp: maxHealth,
      bossHp: bossConfig.hp,
        turn: 0,
      message: bossConfig.intro,
      action: "idle",
      bossAction: "idle",
      ultimate: false,
    bossAttackCount: 0,
      busy: false,
      opening: false,
    heavyReady: false,
      guarding: false,
      result: null,
    });
    turnLocked.current = false;
    changeScene("battle");
  }

  function testClearBoss() {
    if (battle.result) return;
    const rewardName =
      battle.boss === "slime"
        ? "Slime Band"
        : battle.boss === "golem"
          ? "Golem Crest"
          : battle.boss === "owl"
            ? "Frost Feather"
            : "Mire Crown";
    setSave((current) => ({
      ...current,
      rewards: current.rewards.includes(rewardName)
        ? current.rewards
        : [...current.rewards, rewardName],
    }));
    clearTimers();
    setBattle((current) => ({
      ...current,
      bossHp: 0,
      busy: false,
      bossAction: "hit",
      result: "victory",
      message: `Test clear: ${BOSSES[current.boss].name} reduced to 0 HP.`,
    }));
  }

  function battleTurn(move: "attack" | "guard" | "special") {
    if (turnLocked.current || battle.busy || battle.result) return;
    if (move === "special" && save.ultimateStacks <= 0) {
      setBattle((b) => ({ ...b, message: ultimateStatus }));
      return;
    }

    turnLocked.current = true;
    const isUltimate = move === "special";
    if (isUltimate) setSave(consumeUltimate);
    const attackDuration = isUltimate ? ULTIMATE.duration : PLAYER_ATTACK_MS;
    const armor = battle.boss === "golem" ? 6 : battle.boss === "owl" ? 3 : battle.boss === "shellback" ? 4 : 0;
    const baseDamage = Math.max(1, 10 + strength * 2 - armor);
    const rawDamage =
      move === "special"
        ? baseDamage * 2
        : move === "guard"
          ? 0
          : baseDamage;
    const damage = Math.floor(rawDamage * (battle.opening ? 1.5 : 1));
    const bossHp = Math.max(0, battle.bossHp - damage);
    setBattle((b) => ({
      ...b,
      busy: true,
      ultimate: isUltimate,
      action: move === "guard" ? "guard" : isUltimate ? "idle" : "attack",
      bossAction: "idle",
      opening: false,
      guarding: move === "guard",
      message:
        move === "guard"
          ? "You brace for the next attack."
          : move === "special"
            ? "Ultimate! Rook gathers their strength..."
            : "Rook draws their blade. Attack incoming!",
    }));

    if (isUltimate) {
      audio.play("charge");
      later(() => audio.play("charge", 1.25), 250);
      later(() => audio.play("charge", 1.5), 500);
      later(() => audio.play("slash"), ULTIMATE.windup);
      later(() => setBattle(b => ({ ...b, action: "attack", message: "DAWNBREAKER!" })), ULTIMATE.windup);
      later(() => setBattle(b => ({ ...b, ultimate: false, action: "idle" })), ULTIMATE.duration);
    }

    if (damage > 0) {
      later(() => {
        audio.play(isUltimate ? "ultimate" : "hit");
        if (isUltimate) audio.play("magic");
        setBattle((b) => ({
          ...b,
          bossHp,
          bossAction: "hit",
          message:
            move === "special"
              ? `Ultimate hits for ${damage}!`
              : `Your strike deals ${damage} damage!`,
        }));
      }, isUltimate ? ULTIMATE.impact : 300);
    }

    if (bossHp <= 0) {
      later(() => {
        turnLocked.current = false;
        const rewardName =
          battle.boss === "slime"
            ? "Slime Band"
            : battle.boss === "golem"
              ? "Golem Crest"
              : battle.boss === "owl"
                ? "Frost Feather"
                : "Mire Crown";
        setSave((s) => ({
          ...s,
          rewards: s.rewards.includes(rewardName) ? s.rewards : [...s.rewards, rewardName],
        }));
        setBattle((b) => ({
          ...b,
          busy: false,
          result: "victory",
          action: "idle",
          message:
            b.boss === "slime"
              ? "The Training Slime dissolves into sparkles!"
              : b.boss === "golem"
                ? "The Stone Golem kneels. The cavern falls silent."
                : b.boss === "owl"
                  ? "The Frost Owl folds its wings and yields the frozen throne."
                  : "The Ancient Shellback bows. Every arena has been conquered.",
        }));
      }, attackDuration);
      return;
    }

    later(
      () => {
        const nextTurn = battle.turn + 1;
        turnLocked.current = false;
        if (battle.boss === "golem" && battle.heavyReady && damage >= 12) {
          setBattle(b => ({...b, busy:false, turn:nextTurn, heavyReady:false, action:"idle", bossAction:"hit", message:"Shield broken! The slam is canceled."})); return;
        }
        if (battle.boss === "shellback" && move === "guard") {
          setBattle(b => ({...b, busy:false, turn:nextTurn, action:"idle", message:"You brace safely. Shellback counters only damaging moves."})); return;
        }
        if (battle.boss !== "shellback" && !battle.heavyReady && nextTurn % 3 === 2) {
          setBattle((b) => ({
            ...b,
            busy: false,
            turn: nextTurn,
            action: "idle",
            bossAction: "idle",
            heavyReady: true,
            message:
              battle.boss === "slime"
                ? "Training Slime swells up! A heavy SLAM is coming."
                : battle.boss === "golem"
                  ? "Stone Golem raises its shield! Deal 12 damage now to cancel the slam, or Guard."
                  : battle.boss === "owl"
                    ? "Frost Owl gathers a blizzard! An ICE DIVE is coming."
                    : "Ancient Shellback locks into its armor! A MIRE CRUSH is coming.",
          }));
          return;
        }
        const dodged = Math.random() < Math.min(0.25, agility * 0.02);
        const incoming = activeBoss.attack * (battle.heavyReady ? 2 : 1);
        const defended = Math.max(1, incoming - (defense - 1) * 3);
        const dealt = dodged ? 0 : Math.ceil(defended * (move === "guard" ? 0.5 : 1));
        const playerHp = Math.max(0, battle.playerHp - dealt);
        const timing = bossAttackTiming(battle.boss, battle.bossAttackCount + 1);
        setBattle((b) => ({
          ...b,
          opening: battle.boss === "owl" && battle.heavyReady && move === "guard" && agility >= 2,
          busy: true,
          turn: nextTurn,
          action: move === "guard" ? "guard" : "idle",
          bossAction: "attack",
          bossAttackCount: b.bossAttackCount + 1,
          heavyReady: false,
          message: `${activeBoss.name} winds up an attack...`,
        }));
        later(() => {
          if (!dodged) audio.play(move === "guard" ? "guard" : battle.heavyReady ? "heavy" : "hurt");
          setBattle(b => ({
          ...b,
          playerHp,
          action: dodged ? "idle" : "hit",
          message: dodged
            ? "Quick feet! You dodged the attack."
            : move === "guard"
              ? `Guard absorbs the blow. ${dealt} damage taken.${battle.boss === "owl" && battle.heavyReady && agility >= 2 ? " Damage opening earned! Attack next turn for 1.5x damage." : ""}`
              : `${
                  battle.boss === "slime"
                    ? "Slime"
                    : battle.boss === "golem"
                      ? "Golem"
                      : battle.boss === "owl"
                        ? "Owl"
                        : "Shellback"
                } strikes for ${dealt} damage.`,
        }));
        }, timing.impact);
        later(() => {
          turnLocked.current = false;
          setBattle(b => ({
            ...b, busy: false, action: "idle", bossAction: "idle",
            result: playerHp <= 0 ? "defeat" : null,
          }));
        }, timing.duration);
      },
      move === "guard" ? 450 : attackDuration,
    );
  }

  const characterProgressBadge = (
    <div className="floating-character-progress" role="tooltip">
      <b className="character-level">LV {characterLevel(save)}</b>
              <div className="character-xp" title="Train evenly: only one level ahead of your lowest stat counts toward character level. Extra stat levels still improve combat. This bar shows your next eligible stat.">
                <div className="character-xp-label"><small>{characterXp.stat} XP</small><small>{characterXp.earned}/{characterXp.required}</small></div>
                <div className="character-xp-track" role="progressbar" aria-label={`${characterXp.stat} XP toward character level ${characterLevel(save) + 1}`}
                  aria-valuemin={0} aria-valuemax={characterXp.required} aria-valuenow={characterXp.earned}>
                  <i style={{ width: `${characterXp.percent}%` }} />
                </div>
              </div>
    </div>
  );

  const characterHoverCue = <small className="character-hover-cue" aria-hidden="true"><i>i</i><span className="hover-cue-desktop">Hover</span><span className="hover-cue-touch">Tap</span> for level &amp; XP</small>;
  const characterHoverProps = {
    tabIndex: 0,
    role: "group" as const,
    "aria-label": `Rook. Hover, tap, or focus to reveal level ${characterLevel(save)} and XP.`,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") event.currentTarget.focus();
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") event.currentTarget.blur();
    },
  };

  const hud = scene !== "battle" && !exercise;


  return (
    <>
    {accountError && <p className="account-notice" role="alert">{accountError}</p>}
    {saveBlocked && <div className="save-error-overlay"><section className="pixel-frame account-panel" role="alert">
      <h2>{saveStatus === "conflict" ? "Cloud save changed" : "Progress not saved"}</h2>
      <p>{saveError}</p>
      {saveStatus === "conflict" ? <><p>Your local changes are backed up on this device before loading the current cloud save.</p>{conflictRecoveryError && <p>{conflictRecoveryError}</p>}<button className="pixel-button" onClick={recoverConflict}>RELOAD CLOUD SAVE</button></> : <button className="pixel-button" disabled={saveStatus === "saving"} onClick={retry}>{saveStatus === "saving" ? "RETRYING…" : "RETRY SAVE"}</button>}
    </section></div>}
    <div className={`progress-save-status status-${saveStatus}`} role="status" aria-live="polite">
      <i aria-hidden="true" />
      {saveStatus === "saving" ? "Saving progress…" : saveStatus === "error" ? "Save failed · recovery kept on this device" : saveStatus === "conflict" ? "Cloud save changed · reload required" : userId ? "Progress saved to account" : demo ? "Demo progress saved on this device" : "Guest progress saved on this device"}
    </div>
    <div className="game-audio-controls">
      <button className={`game-audio-toggle ${save.sound ? "active" : ""}`} aria-label="Toggle sound" aria-pressed={save.sound}
        title={save.sound ? "Mute music and effects" : "Enable music and effects"} disabled={saveBlocked || loggingOut}
        onClick={() => setSave(s => ({ ...s, sound: !s.sound }))}><PixelIcon type="sound" /></button>
      <label className="game-audio-volume">
        <span>Volume <span aria-hidden="true">{volume}%</span></span>
        <input type="range" min={0} max={100} value={volume} aria-valuetext={`${volume}%`}
          disabled={saveBlocked || loggingOut} onChange={event => {
            const next = event.currentTarget.valueAsNumber;
            setVolume(next);
            try { localStorage.setItem("ironvale-volume", String(next)); } catch { /* Keep the in-session setting. */ }
          }} />
      </label>
    </div>
    <main inert={saveBlocked || loggingOut || undefined} className={`game-shell scene-${scene} ${transition ? "is-transitioning" : ""}`}>
      {userId && onDemoModeChange && <button className="demo-mode-entry" disabled={saveStatus !== "saved" || exercise || scene === "battle" || loggingOut}
        onClick={() => onDemoModeChange(true)}>Open Demo Controls</button>}
      {demo && <details className="demo-controls" style={{position:"fixed",bottom:8,left:8,zIndex:9999,background:"#182018",color:"white",padding:12}}><summary>Demo Controls · Separate Save</summary>
        {demoMode && <><p>Testing with a separate local save. Your account progress is unchanged.</p><button disabled={exercise || scene === "battle" || saveStatus !== "saved"} onClick={() => onDemoModeChange?.(false)}>Return to Account Progress</button></>}
        <p>{demoDate.toLocaleDateString()} · Training streak: {currentStreak(save, demoDate)} days</p>
        <p>Ultimate: {save.ultimateStacks}/3 stacks · Earn one per 3-day training streak. {daysToUltimate === 0 ? "Stacks full." : `${daysToUltimate} more consecutive training days until the next stack.`}</p>
        <button disabled={exercise || battle.busy} onClick={() => {
          const next = nextDemoTrainingDay(save, demoDate);
          setDemoDate(next.date);
          setSave(next.save);
        }}>Next Training Day</button>
        <small>Advances one day and counts a completed training session.</small>
        <button onClick={()=>setDemoDate(d=>{const n=new Date(d);n.setDate(n.getDate()+2);return n;})}>Skip a Day</button>
        {Object.entries(STAT_INFO).map(([key, info]) => <button key={key} disabled={exercise || scene === "battle"} onClick={()=>setSave(s=>({...s,[info.xpKey]:s[info.xpKey]+100}))}>Add 100 {info.label} XP</button>)}
        <div className="demo-level-controls">
          <p>Level shortcuts (demo save only)</p>
          {[3, 5, 7].map(level => <button key={level} disabled={exercise || scene === "battle"} onClick={() => setSave(s => raiseDemoLevel(s, level))}>Reach Level {level}</button>)}
          {(["golem", "owl", "shellback"] as BossKey[]).map(boss => <button key={boss} disabled={exercise || scene === "battle"} onClick={() => setSave(s => unlockDemoBoss(s, boss))}>Unlock {BOSSES[boss].name} (LV {BOSS_REQUIREMENTS[boss].level} + prior clears)</button>)}
        </div>
        <button onClick={()=>{clearTimers(); setCameraEnabled(false);setCameraReady(false);setExercise(false);setReward(null);setModal(null);setScene("base");setTransition(false);setMoving(false);setSave({...DEFAULT_SAVE,rewards:[]});setDemoDate(new Date()); clearDemoWorkouts();}}>Reset Demo</button>
        <button disabled={battle.busy || save.ultimateStacks >= MAX_ULTIMATE_STACKS} onClick={() => setSave(s => ({ ...s, ultimateStacks: Math.min(MAX_ULTIMATE_STACKS, s.ultimateStacks + 1) }))}>Add Ultimate Stack</button>
      </details>}
      {hud && (
        <>
          <div className="player-card">
            <div className="portrait">
              <Character skin={skin} />
            </div>
            <div>
              <span>ADVENTURER</span>
              <strong>{username || "Guest"}</strong>
              <small className={`character-streak ${streakDays > 0 ? "has-streak" : ""}`}
                title="Complete a training session each day to build your streak."
                aria-label={`${streakDays} consecutive training ${streakDays === 1 ? "day" : "days"}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 5-3 6-2 10 2-1 3-3 3-5 4 3 6 6 6 9a8 8 0 0 1-16 0c0-4 3-7 5-9-1 4 0 5 1 6-1-5 5-6 3-11Z" fill="currentColor" /></svg>
                {streakDays} DAY{streakDays === 1 ? "" : "S"} STREAK
              </small>
              <small className="ultimate-stack-note">ULT {save.ultimateStacks}/3<span className="ultimate-earn-hint"> · {daysToUltimate === 0 ? "STACKS FULL" : `+1 IN ${daysToUltimate} TRAINING DAYS`}</span></small>
            </div>
          </div>
          <div className="top-controls">
            <button
              onClick={() => setHint("Settings: progress saves automatically on this device.")}
              aria-label="Settings"
            >
              <PixelIcon type="settings" />
            </button>
            {(userId || demo) && <button className="guild-report-button" onClick={() => setModal("guild")} aria-label="Guild Training Report">Guild</button>}
            <button
              className="logout-button"
              disabled={loggingOut || saveStatus !== "saved"}
              aria-busy={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try { await onLogout(); } finally { setLoggingOut(false); }
              }}
            >
              {userId ? "Log out" : "Sign in"}
            </button>
          </div>
          <div className="stats-hud">
            <StatBar label="STR" xp={save.strengthXp} />
            <StatBar label="AGI" xp={save.agilityXp} />
            <StatBar label="DEF" xp={save.defenseXp} />
            <StatBar label="VIT" xp={save.healthXp} />
          </div>
          <div className="hint-bar">{hint}</div>
        </>
      )}

      {scene === "base" && (
        <section className="room base-room" aria-label="Training base">
          <div className="stone-wall">
            <div className="banner banner-left">V</div>
            <div className="banner banner-right">V</div>
            <div className="window">
              <i />
              <i />
              <i />
            </div>
          </div>
          <button
            className="world-object boss-entry"
            onClick={() => travel(92, 48, () => setModal("boss"), "Approaching the arena gate...")}
          >
            <span className="object-label">BOSS GATE</span>
          </button>
          <button
            className="world-object gym-entry"
            onClick={() => travel(50, 86, () => changeScene("gym"), "Walking to the gym door...")}
          >
            <span className="object-label">ENTER GYM</span>
          </button>
          <button
            className="world-object stats-entry"
            onClick={() => travel(14, 53, () => setModal("stats"), "Walking to reception...")}
          >
            <span className="object-label">PLAYER STATS</span>
          </button>
          <div className="base-sign">
            <i />{" "}
            <p>
              TRAIN AT THE GYM.
              <br />
              GROW STRONGER.
              <br />
              CHALLENGE THE BOSS.
            </p>
          </div>
          <div className="rug" />
          <div className="plant plant-a" />
          <div className="plant plant-b" />
          <div className="lantern lantern-a" />
          <div className="lantern lantern-b" />
          <div {...characterHoverProps} className="player-world character-progress-target" style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%`, "--walk-duration": `${WALK_MS}ms` } as CSSProperties}>
            <Character skin={skin} action={moving ? "walk" : "idle"} facing={worldFacing} />
            {characterProgressBadge}
            {characterHoverCue}
          </div>
        </section>
      )}

      {scene === "gym" && (
        <section className="room gym-room" aria-label="Gym interior">
          <div className="gym-backwall">
            <div className="gym-title">FIT QUEST GYM</div>
            <div className="sword-banner">I</div>
            <div className="sword-banner right">I</div>
          </div>
          <button
            className="world-object station dumbbell-station"
            onClick={() => openStation("curls")}
          >
            <span className="object-label">DUMBBELL RACK</span>
            <div className="rack">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="station-stat">
              STR LV {strength}
              <div>
                <i style={{ width: `${levelProgress(save.strengthXp)}%` }} />
              </div>
            </div>
          </button>
          <button
            className="world-object station squat-station"
            onClick={() => openStation("squats")}
          >
            <span className="object-label">SQUAT MAT</span>
            <div className="squat-rack">
              <i />
              <b />
              <b />
            </div>
            <div className="station-stat">
              AGI LV {agility}
              <div>
                <i style={{ width: `${levelProgress(save.agilityXp)}%` }} />
              </div>
            </div>
          </button>
          <button
            className="world-object station situp-station"
            onClick={() => openStation("situps")}
          >
            <span className="object-label">SIT-UP BENCH</span>
            <div className="station-stat station-stat-compact">
              DEF LV {defense}
              <div>
                <i style={{ width: `${levelProgress(save.defenseXp)}%` }} />
              </div>
            </div>
          </button>
          <button
            className="world-object station treadmill-station"
            onClick={() => openStation("treadmill")}
          >
            <span className="object-label">TREADMILL</span>
            <div className="station-stat station-stat-compact">
              VIT LV {vitality}
              <div>
                <i style={{ width: `${levelProgress(save.healthXp)}%` }} />
              </div>
            </div>
          </button>
          <button
            className="world-object exit-door"
            onClick={() =>
              travel(50, 24, () => changeScene("base"), "Returning to the training base...")
            }
          >
            <span className="object-label">EXIT TO BASE</span>
            <i />
          </button>
          <div className="mat mat-left" />
          <div className="mat mat-right" />
          <div {...characterHoverProps} className="player-world character-progress-target" style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%`, "--walk-duration": `${WALK_MS}ms` } as CSSProperties}>
            <Character skin={skin} action={moving ? "walk" : "idle"} facing={worldFacing} />
            {characterProgressBadge}
            {characterHoverCue}
          </div>
        </section>
      )}

      {modal === "station" && (
        <div className="overlay compact-overlay">
          <Frame title={activeStation.exercise.toUpperCase()} className="station-dialog">
            <div className="dialog-heading">Train {activeStatInfo.label}?</div>
            <p>{activeStation.description}</p>
            <div className="dialog-stat">
              <span>{activeStatInfo.short} LEVEL</span>
              <strong>{activeLevel}</strong>
              <div className="xp-track">
                <i
                  style={{
                    width: `${levelProgress(activeXp)}%`,
                  }}
                />
              </div>
            </div>
            <div className="target-label">{timed ? "ACTIVE-TIME TARGET" : "REP TARGET"}</div>
            <div className="rep-selector">
              {(timed ? [1, 2, 3].map((blocks) => blocks * RUN_BLOCK_SECONDS) : [5, 10, 15]).map((value) => (
                <button
                  key={value}
                  className={target === value ? "selected" : ""}
                  onClick={() => timed ? setRunTarget(value) : setRepTarget(value)}
                >
                  {value}{timed ? "s" : ""}
                </button>
              ))}
              {timed && <button className={`free-run-target ${freeRun ? "selected" : ""}`} onClick={() => setRunTarget("free")}>Free Run</button>}
            </div>
            {freeRun && <p>Run without a time target. Finish anytime, or the session ends after 30 seconds of inactivity.</p>}
            <div className="dialog-actions">
              <button className="pixel-button primary" onClick={startExercise}>
                BEGIN
              </button>
              <button className="pixel-button" onClick={() => setModal(null)}>
                BACK
              </button>
            </div>
          </Frame>
        </div>
      )}

      {modal === "guild" && (
        <GuildTrainingReport demo={demo} sync={syncWorkouts} syncError={workoutSyncError} onClose={() => setModal(null)} />
      )}

      {modal === "stats" && (
        <div className="overlay compact-overlay stats-overlay">
          <Frame title="PLAYER STATS" className="stats-dialog">
            <div className="stats-identity">
              <div className="stats-portrait">
                <Character skin={skin} />
              </div>
              <div>
                <span>ADVENTURER</span>
                <h2>{username || "Guest"}</h2>
                <small>Character Level {characterLevel(save)} · Streak {currentStreak(save, demo ? demoDate : new Date())} days · Ultimate {save.ultimateStacks}/3 stacks · +1 every 3 consecutive training days</small>
              </div>
            </div>
            <p className="stats-note">Balanced training: stats count toward character level up to one level above your lowest stat. Extra stat levels still improve combat. Train {characterXp.stat} next to progress.</p>
            <div className="stats-sheet">
              <div className="stats-sheet-row">
                <div>
                  <span>STRENGTH</span>
                  <strong>LV {strength}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.strengthXp)}%` }} />
                </div>
                <small>{xpProgress(save.strengthXp).earned} / {xpProgress(save.strengthXp).required} XP</small>
              </div>
              <div className="stats-sheet-row agility">
                <div>
                  <span>AGILITY</span>
                  <strong>LV {agility}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.agilityXp)}%` }} />
                </div>
                <small>{xpProgress(save.agilityXp).earned} / {xpProgress(save.agilityXp).required} XP</small>
              </div>
              <div className="stats-sheet-row defense">
                <div>
                  <span>DEFENSE</span>
                  <strong>LV {defense}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.defenseXp)}%` }} />
                </div>
                <small>{xpProgress(save.defenseXp).earned} / {xpProgress(save.defenseXp).required} XP</small>
              </div>
              <div className="stats-sheet-row vitality">
                <div>
                  <span>VITALITY</span>
                  <strong>LV {vitality}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.healthXp)}%` }} />
                </div>
                <small>{xpProgress(save.healthXp).earned} / {xpProgress(save.healthXp).required} XP</small>
              </div>
            </div>
            <p>{skin < 5 ? `Next appearance at character level ${(skin+1)*2+1}` : "Final appearance unlocked"}</p>
            <div className="combat-summary">
              <div>
                <span>ATTACK BONUS</span>
                <strong>+{strength * 2}</strong>
              </div>
              <div>
                <span>DODGE CHANCE</span>
                <strong>{Math.round(Math.min(0.25, agility * 0.02) * 100)}%</strong>
              </div>
              <div>
                <span>DAMAGE BLOCK</span>
                <strong>{(defense - 1) * 3}</strong>
              </div>
              <div>
                <span>MAX HEALTH</span>
                <strong>{maxHealth}</strong>
              </div>
            </div>
            <p className="stats-note">Train in the gym to improve these battle bonuses.</p>
            <button className="pixel-button primary full" onClick={() => setModal(null)}>
              CLOSE
            </button>
          </Frame>
        </div>
      )}

      {modal === "boss" && (
        <div className="overlay compact-overlay">
          <Frame title="ARENA GATE" className="boss-dialog">
            <div className="boss-select">
              {featuredBoss === "slime" ? (
                <SlimeSprite className="slime-preview featured-boss-sprite" />
              ) : featuredBoss === "golem" ? (
                <GolemSprite className="featured-boss-sprite featured-golem" />
              ) : featuredBoss === "owl" ? (
                <OwlSprite className="featured-boss-sprite featured-owl" />
              ) : (
                <ShellbackSprite className="featured-boss-sprite featured-shellback" />
              )}
              <div>
                <span className="difficulty">
                  {featuredBoss === "slime"
                    ? "BEGINNER • RANK I"
                    : featuredBoss === "golem"
                      ? "INTERMEDIATE • RANK II"
                      : featuredBoss === "owl"
                        ? "ELITE • RANK III"
                        : "FINAL • RANK IV"}
                </span>
                <h2>{BOSSES[featuredBoss].name}</h2>
                <div className="boss-stats">
                  <span>
                    HP <b>{BOSSES[featuredBoss].hp}</b>
                  </span>
                  <span>
                    ATK <b>{BOSSES[featuredBoss].attack}</b>
                  </span>
                </div>
              </div>
            </div>
            <p>
              {featuredBoss === "slime"
                ? "Weak, wobbly, and ready to test your new skills. Heavy attacks are announced one turn early."
                : featuredBoss === "golem"
                  ? "A relentless guardian of the lower cavern. Watch for its crushing blows and cycling stone attacks."
                  : featuredBoss === "owl"
                    ? "Master of the frozen throne. Survive its swift dives and the blizzard it gathers overhead."
                    : "The final guardian waits beneath an ancient iron shell. Break through the mire and conquer the last arena."}
            </p>
            <p className="stats-note">{featuredBoss === "slime" ? "Practice Guard before a telegraphed slam." : featuredBoss === "golem" ? `Strength ${strength}/4 recommended · ${Math.min(save.strengthXp,600)}/600 XP. Train curls to break the shield with a 12-damage hit. Guard remains an option.` : featuredBoss === "owl" ? `Agility ${agility}/2 recommended · ${Math.min(save.agilityXp,100)}/100 XP. Guard the dive for a one-turn damage opening.` : `Defense ${defense}/3 recommended · ${Math.min(save.defenseXp,300)}/300 XP. Train sit-ups to resist counters; Guard avoids its counter.`}</p>
            {featuredBoss !== "golem" && (
              <div className={`future-boss ${golemUnlocked ? "unlocked" : ""}`}>
                <span className="golem-arena-preview" aria-hidden="true">
                  <GolemSprite className="golem-preview" />
                </span>
                <div>
                  <b>STONE GOLEM</b>
                  <small>
                    {golemUnlocked
                      ? "Rank II • 100 HP • Ready"
                      : bossLockReason(save, "golem")}
                  </small>
                </div>
                <button
                  className="pixel-button golem-entry"
                  disabled={!golemUnlocked}
                  onClick={() => beginBattle("golem")}
                >
                  {golemUnlocked ? "REPLAY" : "LOCKED"}
                </button>
              </div>
            )}
            {featuredBoss !== "owl" && (
              <div className={`future-boss ice-boss ${owlUnlocked ? "unlocked" : ""}`}>
                <span className="owl-arena-preview" aria-hidden="true">
                  <OwlSprite className="owl-preview" />
                </span>
                <div>
                  <b>FROST OWL</b>
                  <small>
                    {owlUnlocked ? "Rank III • 90 HP • Ready" : bossLockReason(save, "owl")}
                  </small>
                </div>
                <button
                  className="pixel-button golem-entry"
                  disabled={!owlUnlocked}
                  onClick={() => beginBattle("owl")}
                >
                  {owlUnlocked ? "ENTER" : "LOCKED"}
                </button>
              </div>
            )}
            {featuredBoss !== "shellback" && (
              <div className={`future-boss mire-boss ${shellbackUnlocked ? "unlocked" : ""}`}>
                <span className="shellback-arena-preview" aria-hidden="true">
                  <ShellbackSprite className="shellback-preview" />
                </span>
                <div>
                  <b>ANCIENT SHELLBACK</b>
                  <small>
                    {shellbackUnlocked
                      ? "Final Rank • 120 HP • Ready"
                      : bossLockReason(save, "shellback")}
                  </small>
                </div>
                <button
                  className="pixel-button golem-entry"
                  disabled={!shellbackUnlocked}
                  onClick={() => beginBattle("shellback")}
                >
                  {shellbackUnlocked ? "ENTER" : "LOCKED"}
                </button>
              </div>
            )}
            <p className="stats-note">Requires Character Level {BOSS_REQUIREMENTS[featuredBoss].level} / You are Level {characterLevel(save)}{bossLockReason(save, featuredBoss) && ` / ${bossLockReason(save, featuredBoss)}`}</p>
            <div className="dialog-actions">
              <button className="pixel-button danger" disabled={!!bossLockReason(save, featuredBoss)} onClick={() => beginBattle(featuredBoss)}>
                FIGHT{" "}
                {featuredBoss === "slime"
                  ? "SLIME"
                  : featuredBoss === "golem"
                    ? "GOLEM"
                    : featuredBoss === "owl"
                      ? "OWL"
                      : "SHELLBACK"}
              </button>
              <button className="pixel-button" onClick={() => setModal(null)}>
                BACK
              </button>
            </div>
          </Frame>
        </div>
      )}

      {exercise && (
        <div className="exercise-overlay">
          <div className="exercise-top">
            <div>
              <span>TRAINING SESSION</span>
              <strong>{freeRun ? "Treadmill Free Run" : activeStation.exercise}</strong>
            </div>
            <div className="session-stat">
              {activeStatInfo.label.toUpperCase()} • LV {activeLevel}
            </div>
          </div>
          <div className="training-layout">
            <Frame className="camera-panel">
              <div className="camera-view">
                {cameraEnabled && !paused && !reward && !saveBlocked && !loggingOut && (
                  <WorkoutCamera
                    exercise={activeStation.tracking}
                    onReady={onCameraReady}
                    onError={onCameraError}
                    onProgress={stableProgress}
                    onFeedback={setFeedback}
                  />
                )}
                <div className="camera-guide" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                {(!cameraReady || paused || reward) && (
                  <div className="camera-message">
                    <PixelIcon type="camera" />
                    <strong>
                      {reward ? "TRAINING COMPLETE" : paused ? "CAMERA PAUSED" :
                        cameraEnabled ? "STARTING POSE TRACKING..." : "CAMERA OFF"}
                    </strong>
                    <span>{cameraError || exercises[activeStation.tracking].frame}</span>
                    {!cameraEnabled && !paused && !reward && (
                      <button className="pixel-button" onClick={() => {
                        setCameraError("");
                        setFeedback(exercises[activeStation.tracking].frame);
                        setCameraEnabled(true);
                      }}>
                        {cameraError ? "TRY AGAIN" : "ENABLE CAMERA"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="camera-footer">
                <span className={`status-dot ${cameraReady && !reward ? "active" : ""}`} />
                {cameraReady && !reward ? "POSE TRACKING ACTIVE" : "POSE TRACKING OFF"}
              </div>
            </Frame>
            <div className="training-side">
              <Frame title="AVATAR FORM" className="avatar-training">
                <div className="mini-gym">
                  <Character skin={skin} action={paused ? "idle" : activeStation.action} />
                  <div className={`mini-equipment mini-${selected}`} />
                </div>
              </Frame>
              <Frame className="rep-panel">
                <span>{timed ? "ACTIVE SECONDS" : "REPS"}</span>
                <div className="rep-count">
                  {shownProgress}
                  {!freeRun && <small>/ {target}</small>}
                </div>
                <div className={`feedback ${feedback === "Rep counted!" ? "success" : ""}`}>
                  {paused ? "Training paused." : feedback}
                </div>
                {freeRun ? !reward && <p className="free-run-countdown" role="timer">Inactivity timeout in {idleSeconds}s</p> : (
                  <div className="session-progress">
                    <i style={{ width: `${(progress / goal) * 100}%` }} />
                  </div>
                )}
                <div className="xp-preview">
                  +{xpEarned} {activeStatInfo.label} XP
                </div>
              </Frame>
            </div>
          </div>
          <div className="training-controls">
            {demo && (
              <div className="demo-controls">
                <span>DEMO MODE</span>
                <button
                  className="pixel-button primary"
                  disabled={cameraEnabled || paused || !!reward}
                  onClick={() => addProgress(timed ? RUN_BLOCK_SECONDS * 1000 : 1)}
                >
                  {timed ? "SIMULATE 30 SECONDS" : "SIMULATE REP"}
                </button>
              </div>
            )}
            <div className="session-buttons">
              <button className="pixel-button" onClick={() => {
                setCameraReady(false);
                setPaused((value) => !value);
              }}>
                <PixelIcon type="pause" /> {paused ? "RESUME" : "PAUSE"}
              </button>
              <button className="pixel-button danger" onClick={finishExercise}>
                FINISH
              </button>
            </div>
          </div>
          {reward && (
            <div className="overlay reward-overlay">
              <Frame title="SESSION COMPLETE" className="reward-card">
                <div className={`reward-burst ${reward.leveled ? "level-up" : ""}`}>
                  {reward.leveled ? "LEVEL UP!" : "TRAINING COMPLETE"}
                </div>
                <strong className="xp-earned">
                  +{reward.xp} {activeStatInfo.label.toUpperCase()} XP
                </strong>
                <div className="reward-xp">
                  <i />
                </div>
                <p>
                  {reward.inactive ? "Free Run ended after 30 seconds of inactivity." : reward.leveled
                    ? "Your hard work made you stronger."
                    : "Progress saved. Keep training!"}
                </p>
                <button className="pixel-button primary full" onClick={finishExercise}>
                  CONTINUE
                </button>
              </Frame>
            </div>
          )}
        </div>
      )}

      {scene === "battle" && (
        <section className={`battle-room arena-${battle.boss} ${battle.ultimate ? "is-ultimate" : ""}`}>
          {battle.ultimate && <UltimateEffect />}
          <div className="battle-backdrop">
            <div className="moon" />
            <div className="pillar p1" />
            <div className="pillar p2" />
            <div className="torch t1" />
            <div className="torch t2" />
          </div>
          <div
            style={{ "--attack-duration": `${PLAYER_ATTACK_MS}ms` } as CSSProperties}
            {...characterHoverProps}
            className={`fighter player-fighter character-progress-target ${battle.action === "attack" ? "is-attacking" : ""}`}
          >
            <div className="combat-hp">
              <span>{username || "Guest"}</span>
              <div>
                <i style={{ width: `${(battle.playerHp / maxHealth) * 100}%` }} />
              </div>
              <b>
                {battle.playerHp}/{maxHealth}
              </b>
            </div>
            <Character skin={skin} action={battle.action} facing="back" />
            {characterProgressBadge}
            {characterHoverCue}
          </div>
          <div
            style={{ "--attack-duration": `${bossAttackTiming(battle.boss, battle.bossAttackCount).duration}ms` } as CSSProperties}
            className={`fighter boss-fighter boss-${battle.bossAction} ${
              battle.boss === "golem" ? "golem-fighter" : ""
            } ${battle.boss === "owl" ? "owl-fighter" : ""} ${
              battle.boss === "shellback" ? "shellback-fighter" : ""
            } ${
              battle.boss === "golem" && battle.bossAction === "attack" && golemAttackPattern !== 0
                ? "golem-rush"
                : ""
            } ${
              battle.boss === "shellback" &&
              battle.bossAction === "attack" &&
              shellbackAttackPattern !== 0
                ? "shellback-slam"
                : ""
            }`}
          >
            <div className="combat-hp boss-hp">
              <span>{activeBoss.name}</span>
              <div>
                <i style={{ width: `${(battle.bossHp / activeBoss.hp) * 100}%` }} />
              </div>
              <b>
                {battle.bossHp}/{activeBoss.hp}
              </b>
            </div>
            {battle.boss === "golem" && battle.bossAction === "attack" ? (
              <GolemAttackSprite key={battle.bossAttackCount} pattern={golemAttackPattern} />
            ) : battle.boss === "golem" ? (
              <GolemSprite
                className="combat-golem"
                animate={battle.bossAction !== "hit" && !battle.result}
              />
            ) : battle.boss === "owl" && battle.bossAction === "attack" ? (
              <OwlAttackSprite key={battle.bossAttackCount} pattern={owlAttackPattern} />
            ) : battle.boss === "owl" ? (
              <OwlSprite
                className="combat-owl"
                animate={battle.bossAction !== "hit" && !battle.result}
              />
            ) : battle.boss === "shellback" && battle.bossAction === "attack" ? (
              <ShellbackAttackSprite
                key={battle.bossAttackCount}
                pattern={shellbackAttackPattern}
              />
            ) : battle.boss === "shellback" ? (
              <ShellbackSprite
                className="combat-shellback"
                animate={battle.bossAction !== "hit" && !battle.result}
              />
            ) : battle.bossAction === "attack" ? (
              <SlimeAttackSprite
                key={battle.bossAttackCount}
                pattern={(battle.bossAttackCount + 2) % SLIME_ATTACK_PATTERNS.length}
              />
            ) : (
              <SlimeSprite
                className="combat-slime"
                animate={battle.bossAction === "idle" && !battle.result}
              />
            )}
          </div>
          <div className="battle-ui">
            <Frame className="battle-dialogue">
              <p>{battle.message}</p>
              {demo && <button className="test-ko-button" disabled={battle.busy || !!battle.result} onClick={testClearBoss}>
                DEMO: DEFEAT BOSS
              </button>}
            </Frame>
            <Frame title="COMMAND" className="command-panel">
              <button disabled={battle.busy} onClick={() => battleTurn("attack")}>
                <b>ATTACK</b>
                <span>Strike with STR</span>
              </button>
              <button disabled={battle.busy} onClick={() => battleTurn("guard")}>
                <b>GUARD</b>
                <span>Reduce damage</span>
              </button>
              <button
                disabled={battle.busy || save.ultimateStacks === 0}
                title={ultimateStatus}
                aria-label={`Ultimate: ${ultimateStatus}`}
                onClick={() => battleTurn("special")}
              >
                <b>ULTIMATE</b>
                <small>{ultimateStatus}</small>
                <span className="ultimate-stack-meter" aria-label={`${save.ultimateStacks} of 3 Ultimate stacks`}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={save.ultimateStacks >= n ? "filled" : ""} />
                  ))}
                </span>
              </button>
            </Frame>
          </div>
          {battle.result && (
            <div className="overlay compact-overlay">
              <Frame
                title={battle.result === "victory" ? "VICTORY" : "DEFEATED"}
                className="result-card"
              >
                {battle.result === "victory" ? (
                  <>
                    <div className="reward-item">
                      <div
                        className={
                          battle.boss === "slime"
                            ? "slime-band"
                            : battle.boss === "golem"
                              ? "golem-crest"
                              : battle.boss === "owl"
                                ? "frost-feather"
                                : "mire-crown"
                        }
                      />
                      <div>
                        <small>
                          {!nextBoss ? "ALL ARENAS CLEARED" : nextBossLocked ? "NEXT BOSS · LEVEL REQUIRED" : "BOSS UNLOCKED"}
                        </small>
                        <strong>
                          {battle.boss === "slime"
                            ? "STONE GOLEM"
                            : battle.boss === "golem"
                              ? "FROST OWL"
                              : battle.boss === "owl"
                                ? "ANCIENT SHELLBACK"
                                : "MIRE CROWN"}
                        </strong>
                      </div>
                    </div>
                    <p>
                      {nextBoss ? nextBossLocked || `${BOSSES[nextBoss].name} is available at the arena gate.` : "Every arena champion has been defeated."}
                    </p>
                    <button
                      className="pixel-button primary full"
                      onClick={() => changeScene("base")}
                    >
                      RETURN TO BASE
                    </button>
                  </>
                ) : (
                  <>
                    <p>Your earned training XP is safe. Train more or try again.</p>
                    <button
                      className="pixel-button primary full"
                      onClick={() => beginBattle(battle.boss)}
                    >
                      RETRY
                    </button>
                    <button className="pixel-button full" onClick={() => changeScene("gym")}>
                      RETURN TO TRAINING
                    </button>
                  </>
                )}
              </Frame>
            </div>
          )}
        </section>
      )}
    </main>
    </>
  );
}
