import { useCallback, useEffect, useRef, useState } from "react";
import AuthScreen from "./AuthScreen";
import { levelFromXp, levelProgress, loadSave, STAT_INFO, type SaveData } from "./game/progression";
import { RUN_BLOCK_SECONDS, STATIONS, XP_PER_UNIT, type CharacterAction, type StationKey } from "./training/stations";
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
type BossKey = "slime" | "golem" | "owl" | "shellback";
const BOSSES = {
  slime: {
    name: "TRAINING SLIME",
    hp: 85,
    attack: 14,
    intro: "The Training Slime jiggles into your path!",
  },
  golem: {
    name: "STONE GOLEM",
    hp: 150,
    attack: 16,
    intro: "The Stone Golem awakens and blocks your path!",
  },
  owl: {
    name: "FROST OWL",
    hp: 220,
    attack: 30,
    intro: "The Frost Owl descends in a storm of crystal feathers!",
  },
  shellback: {
    name: "ANCIENT SHELLBACK",
    hp: 300,
    attack: 36,
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

function useAnimationFrame(active: boolean, interval: number, frameCount = 2, loop = true) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) {
      setFrame(0);
      return;
    }
    setFrame(0);
    const timer = window.setInterval(
      () =>
        setFrame((current) =>
          loop ? (current + 1) % frameCount : Math.min(current + 1, frameCount - 1),
        ),
      interval,
    );
    return () => window.clearInterval(timer);
  }, [active, frameCount, interval, loop]);
  return frame;
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
    action === "attack" ? 100 : action === "walk" ? 220 : 520,
    frames.length,
    action !== "attack",
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
      <div className="xp-track" aria-label={`${label} experience ${levelProgress(xp)} of 100`}>
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

export default function App() {
  const [enteredGame, setEnteredGame] = useState(false);
  const [save, setSave] = useState<SaveData>(() => loadSave(CHARACTER_MODELS.length));
  const [scene, setScene] = useState<Scene>("base");
  const [modal, setModal] = useState<"station" | "boss" | "wardrobe" | "stats" | null>(null);
  const [selected, setSelected] = useState<StationKey>("curls");
  const [repTarget, setRepTarget] = useState(5);
  const [runTarget, setRunTarget] = useState(RUN_BLOCK_SECONDS);
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 64 });
  const [moving, setMoving] = useState(false);
  const [worldFacing, setWorldFacing] = useState<"left" | "right" | "back">("left");
  const [hint, setHint] = useState("Choose a destination to begin your training.");
  const [transition, setTransition] = useState(false);
  const [exercise, setExercise] = useState(false);
  const [progress, setProgress] = useState(0);
  const sessionProgress = useRef(0);
  const [feedback, setFeedback] = useState("Complete the movement.");
  const [paused, setPaused] = useState(false);
  const [reward, setReward] = useState<{ xp: number; leveled: boolean } | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [battle, setBattle] = useState({
    boss: "slime" as BossKey,
    playerHp: 100,
    bossHp: 85,
    charge: 0,
    turn: 0,
    message: "The Training Slime jiggles into your path!",
    action: "idle" as "idle" | "attack" | "guard" | "hit",
    bossAction: "idle" as "idle" | "attack" | "hit",
    bossAttackCount: 0,
    busy: false,
    heavyReady: false,
    guarding: false,
    result: null as "victory" | "defeat" | null,
  });

  const strength = levelFromXp(save.strengthXp);
  const agility = levelFromXp(save.agilityXp);
  const defense = levelFromXp(save.defenseXp);
  const vitality = levelFromXp(save.healthXp);
  const maxHealth = 100 + (vitality - 1) * 15;
  const activeStation = STATIONS[selected];
  const timed = activeStation.tracking === "run";
  const target = timed ? runTarget : repTarget;
  const setTarget = timed ? setRunTarget : setRepTarget;
  const goal = timed ? target * 1000 : target;
  const shownProgress = timed ? Math.floor(progress / 1000) : progress;
  const rewardUnits = timed ? Math.floor(shownProgress / RUN_BLOCK_SECONDS) : progress;
  const selectedStat = activeStation.stat;
  const activeStatInfo = STAT_INFO[selectedStat];
  const activeXp = save[activeStatInfo.xpKey];
  const activeLevel = levelFromXp(activeXp);
  const golemUnlocked = save.rewards.includes("Slime Band");
  const owlUnlocked = save.rewards.includes("Golem Crest");
  const shellbackUnlocked = save.rewards.includes("Frost Feather");
  const featuredBoss: BossKey = !golemUnlocked
    ? "slime"
    : !owlUnlocked
      ? "golem"
      : !shellbackUnlocked
        ? "owl"
        : "shellback";
  const activeBoss = BOSSES[battle.boss];
  const golemAttackPattern = (battle.bossAttackCount + 2) % 3;
  const owlAttackPattern = (battle.bossAttackCount + 1) % 2;
  const shellbackAttackPattern = (battle.bossAttackCount + 2) % 3;

  useEffect(() => {
    localStorage.setItem("ironvale-save", JSON.stringify(save));
  }, [save]);

  function changeScene(next: Scene) {
    setTransition(true);
    setTimeout(() => {
      setScene(next);
      setModal(null);
      setWorldFacing("left");
      setPlayerPos({ x: 50, y: next === "gym" ? 70 : 64 });
      setHint(
        next === "gym"
          ? "Choose a station, or return to the base."
          : "Choose a destination to begin your training.",
      );
      setTimeout(() => setTransition(false), 250);
    }, 250);
  }

  function travel(x: number, y: number, onArrive: () => void, travelHint: string) {
    setHint(travelHint);
    if (scene !== "battle") {
      setWorldFacing(y < playerPos.y ? "back" : x > playerPos.x ? "right" : "left");
    }
    setMoving(true);
    setPlayerPos({ x, y });
    setTimeout(() => {
      setMoving(false);
      onArrive();
    }, 900);
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
    sessionProgress.current = 0;
    setProgress(0);
    setFeedback(exercises[activeStation.tracking].frame);
    setPaused(false);
    setReward(null);
    setCameraError("");
    setExercise(true);
  }

  const addProgress = useCallback((amount: number) => {
    if (sessionProgress.current >= goal) return;
    const next = Math.min(goal, sessionProgress.current + amount);
    sessionProgress.current = next;
    setProgress(timed ? Math.floor(next / 1000) * 1000 : next);
    if (next === goal) {
      const key = activeStatInfo.xpKey;
      const gained = (timed ? target / RUN_BLOCK_SECONDS : target) * XP_PER_UNIT;
      setSave((current) => ({ ...current, [key]: current[key] + gained }));
      setReward({ xp: gained, leveled: levelFromXp(activeXp + gained) > levelFromXp(activeXp) });
    }
  }, [goal, timed, activeStatInfo.xpKey, target, activeXp]);

  const onCameraReady = useCallback(() => setCameraReady(true), []);
  const onCameraError = useCallback((message: string) => {
    setCameraEnabled(false);
    setCameraReady(false);
    setCameraError(message);
    setFeedback(message);
  }, []);

  function finishExercise() {
    setCameraEnabled(false);
    setCameraReady(false);
    setExercise(false);
    setReward(null);
    setHint(reward ? "Training complete. Your progress has been saved." : "Training ended.");
  }

  function beginBattle(boss: BossKey = "slime") {
    if (boss === "golem" && !golemUnlocked) return;
    if (boss === "owl" && !owlUnlocked) return;
    if (boss === "shellback" && !shellbackUnlocked) return;
    const bossConfig = BOSSES[boss];
    setBattle({
      boss,
      playerHp: maxHealth,
      bossHp: bossConfig.hp,
      charge: 0,
      turn: 0,
      message: bossConfig.intro,
      action: "idle",
      bossAction: "idle",
      bossAttackCount: 0,
      busy: false,
      heavyReady: false,
      guarding: false,
      result: null,
    });
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
    if (battle.busy || battle.result) return;
    if (move === "special" && battle.charge < 3) {
      setBattle((b) => ({ ...b, message: "Special needs three charge segments." }));
      return;
    }

    const baseDamage = 10 + strength * 3;
    const damage =
      move === "special"
        ? baseDamage * 2
        : move === "guard"
          ? 0
          : baseDamage + Math.floor(Math.random() * 5);
    const bossHp = Math.max(0, battle.bossHp - damage);
    setBattle((b) => ({
      ...b,
      busy: true,
      action: move === "guard" ? "guard" : "attack",
      bossAction: "idle",
      guarding: move === "guard",
      charge: move === "special" ? 0 : Math.min(3, b.charge + 1),
      message:
        move === "guard"
          ? "You brace for the next attack."
          : move === "special"
            ? "Power Rush! Rook gathers their strength..."
            : "Rook draws their blade. Attack incoming!",
    }));

    if (damage > 0) {
      setTimeout(() => {
        setBattle((b) => ({
          ...b,
          bossHp,
          bossAction: "hit",
          message:
            move === "special"
              ? `Power Rush hits for ${damage}!`
              : `Your strike deals ${damage} damage!`,
        }));
      }, 300);
    }

    if (bossHp <= 0) {
      setTimeout(() => {
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
          message:
            b.boss === "slime"
              ? "The Training Slime dissolves into sparkles!"
              : b.boss === "golem"
                ? "The Stone Golem kneels. The cavern falls silent."
                : b.boss === "owl"
                  ? "The Frost Owl folds its wings and yields the frozen throne."
                  : "The Ancient Shellback bows. Every arena has been conquered.",
        }));
      }, 740);
      return;
    }

    setTimeout(
      () => {
        const nextTurn = battle.turn + 1;
        if (!battle.heavyReady && nextTurn % 3 === 2) {
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
                  ? "Stone Golem raises both fists! A CRUSHING BLOW is coming."
                  : battle.boss === "owl"
                    ? "Frost Owl gathers a blizzard! An ICE DIVE is coming."
                    : "Ancient Shellback locks into its armor! A MIRE CRUSH is coming.",
          }));
          return;
        }
        const dodged = Math.random() < Math.min(0.45, 0.06 + agility * 0.04);
        const incoming =
          battle.boss === "shellback"
            ? battle.heavyReady
              ? 62
              : 28 + Math.floor(Math.random() * 9)
            : battle.boss === "owl"
              ? battle.heavyReady
                ? 54
                : 24 + Math.floor(Math.random() * 8)
              : battle.boss === "golem"
                ? battle.heavyReady
                  ? 30
                  : 12 + Math.floor(Math.random() * 6)
                : battle.heavyReady
                  ? 30
                  : 12 + Math.floor(Math.random() * 6);
        const defended = Math.max(1, incoming - (defense - 1) * 3);
        const dealt = dodged ? 0 : Math.round(defended * (move === "guard" ? 0.35 : 1));
        const playerHp = Math.max(0, battle.playerHp - dealt);
        setBattle((b) => ({
          ...b,
          playerHp,
          busy: true,
          turn: nextTurn,
          action: dodged ? "idle" : "hit",
          bossAction: "attack",
          bossAttackCount: b.bossAttackCount + 1,
          heavyReady: false,
          message: dodged
            ? "Quick feet! You dodged the attack."
            : move === "guard"
              ? `Guard absorbs the blow. ${dealt} damage taken.`
              : `${
                  battle.boss === "slime"
                    ? "Slime"
                    : battle.boss === "golem"
                      ? "Golem"
                      : battle.boss === "owl"
                        ? "Owl"
                        : "Shellback"
                } strikes for ${dealt} damage.`,
          result: playerHp <= 0 ? "defeat" : null,
        }));
        setTimeout(
          () =>
            setBattle((b) =>
              b.result ? b : { ...b, busy: false, action: "idle", bossAction: "idle" },
            ),
          780,
        );
      },
      move === "guard" ? 450 : 780,
    );
  }

  const hud = scene !== "battle" && !exercise;

  if (!enteredGame) return <AuthScreen onGuest={() => setEnteredGame(true)} />;

  return (
    <main className={`game-shell scene-${scene} ${transition ? "is-transitioning" : ""}`}>
      {hud && (
        <>
          <div className="player-card">
            <div className="portrait">
              <Character skin={save.skin} />
            </div>
            <div>
              <span>ADVENTURER</span>
              <strong>ROOK</strong>
            </div>
          </div>
          <div className="top-controls">
            <button
              className={save.sound ? "active" : ""}
              onClick={() => setSave((s) => ({ ...s, sound: !s.sound }))}
              aria-label="Toggle sound"
            >
              <PixelIcon type="sound" />
            </button>
            <button
              onClick={() => setHint("Settings: progress saves automatically on this device.")}
              aria-label="Settings"
            >
              <PixelIcon type="settings" />
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
          <button
            className="world-object wardrobe"
            onClick={() => travel(68, 38, () => setModal("wardrobe"), "Checking the wardrobe...")}
          >
            <span className="object-label">WARDROBE</span>
            <i />
            <i />
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
          <div className="player-world" style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}>
            <Character skin={save.skin} action={moving ? "walk" : "idle"} facing={worldFacing} />
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
          <div className="player-world" style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}>
            <Character skin={save.skin} action={moving ? "walk" : "idle"} facing={worldFacing} />
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
                  onClick={() => setTarget(value)}
                >
                  {value}{timed ? "s" : ""}
                </button>
              ))}
            </div>
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

      {modal === "wardrobe" && (
        <div className="overlay compact-overlay">
          <Frame title="WARDROBE" className="wardrobe-dialog">
            <div className="wardrobe-preview back-preview">
              <Character skin={save.skin} />
            </div>
            <p>Choose your character model.</p>
            <div className="swatches">
              {CHARACTER_MODELS.map(([sprite], skin) => (
                <button
                  key={skin}
                  className={`swatch ${save.skin === skin ? "selected" : ""}`}
                  onClick={() => setSave((s) => ({ ...s, skin }))}
                  aria-label={`Character model ${skin + 1}`}
                >
                  <img src={sprite} alt="" />
                </button>
              ))}
            </div>
            {save.rewards.includes("Slime Band") && (
              <div className="owned-item">EQUIPPED: SLIME BAND</div>
            )}
            <button className="pixel-button primary full" onClick={() => setModal(null)}>
              DONE
            </button>
          </Frame>
        </div>
      )}

      {modal === "stats" && (
        <div className="overlay compact-overlay">
          <Frame title="PLAYER STATS" className="stats-dialog">
            <div className="stats-identity">
              <div className="stats-portrait">
                <Character skin={save.skin} />
              </div>
              <div>
                <span>ADVENTURER</span>
                <h2>ROOK</h2>
                <small>Training Rank {strength + agility + defense + vitality}</small>
              </div>
            </div>
            <div className="stats-sheet">
              <div className="stats-sheet-row">
                <div>
                  <span>STRENGTH</span>
                  <strong>LV {strength}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.strengthXp)}%` }} />
                </div>
                <small>{levelProgress(save.strengthXp)} / 100 XP</small>
              </div>
              <div className="stats-sheet-row agility">
                <div>
                  <span>AGILITY</span>
                  <strong>LV {agility}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.agilityXp)}%` }} />
                </div>
                <small>{levelProgress(save.agilityXp)} / 100 XP</small>
              </div>
              <div className="stats-sheet-row defense">
                <div>
                  <span>DEFENSE</span>
                  <strong>LV {defense}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.defenseXp)}%` }} />
                </div>
                <small>{levelProgress(save.defenseXp)} / 100 XP</small>
              </div>
              <div className="stats-sheet-row vitality">
                <div>
                  <span>VITALITY</span>
                  <strong>LV {vitality}</strong>
                </div>
                <div className="xp-track">
                  <i style={{ width: `${levelProgress(save.healthXp)}%` }} />
                </div>
                <small>{levelProgress(save.healthXp)} / 100 XP</small>
              </div>
            </div>
            <div className="combat-summary">
              <div>
                <span>ATTACK BONUS</span>
                <strong>+{strength * 3}</strong>
              </div>
              <div>
                <span>DODGE CHANCE</span>
                <strong>{Math.round(Math.min(0.45, 0.06 + agility * 0.04) * 100)}%</strong>
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
            {featuredBoss !== "golem" && (
              <div className={`future-boss ${golemUnlocked ? "unlocked" : ""}`}>
                <span className="golem-arena-preview" aria-hidden="true">
                  <GolemSprite className="golem-preview" />
                </span>
                <div>
                  <b>STONE GOLEM</b>
                  <small>
                    {golemUnlocked
                      ? "Rank II • 150 HP • Cleared"
                      : "Defeat the Training Slime to unlock"}
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
                    {owlUnlocked ? "Rank III • 220 HP • Ready" : "Defeat the Stone Golem to unlock"}
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
            {owlUnlocked && featuredBoss !== "shellback" && (
              <div className={`future-boss mire-boss ${shellbackUnlocked ? "unlocked" : ""}`}>
                <span className="shellback-arena-preview" aria-hidden="true">
                  <ShellbackSprite className="shellback-preview" />
                </span>
                <div>
                  <b>ANCIENT SHELLBACK</b>
                  <small>
                    {shellbackUnlocked
                      ? "Final Rank • 300 HP • Ready"
                      : "Defeat the Frost Owl to unlock"}
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
            <div className="dialog-actions">
              <button className="pixel-button danger" onClick={() => beginBattle(featuredBoss)}>
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
              <strong>{activeStation.exercise}</strong>
            </div>
            <div className="session-stat">
              {activeStatInfo.label.toUpperCase()} • LV {activeLevel}
            </div>
          </div>
          <div className="training-layout">
            <Frame className="camera-panel">
              <div className="camera-view">
                {cameraEnabled && !paused && !reward && (
                  <WorkoutCamera
                    exercise={activeStation.tracking}
                    onReady={onCameraReady}
                    onError={onCameraError}
                    onProgress={addProgress}
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
                  <Character skin={save.skin} action={paused ? "idle" : activeStation.action} />
                  <div className={`mini-equipment mini-${selected}`} />
                </div>
              </Frame>
              <Frame className="rep-panel">
                <span>{timed ? "ACTIVE SECONDS" : "REPS"}</span>
                <div className="rep-count">
                  {shownProgress}
                  <small>/ {target}</small>
                </div>
                <div className={`feedback ${feedback === "Rep counted!" ? "success" : ""}`}>
                  {paused ? "Training paused." : feedback}
                </div>
                <div className="session-progress">
                  <i style={{ width: `${(progress / goal) * 100}%` }} />
                </div>
                <div className="xp-preview">
                  +{rewardUnits * XP_PER_UNIT} {activeStatInfo.label} XP
                </div>
              </Frame>
            </div>
          </div>
          <div className="training-controls">
            {import.meta.env.DEV && (
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
                  {reward.leveled
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
        <section className={`battle-room arena-${battle.boss}`}>
          <div className="battle-backdrop">
            <div className="moon" />
            <div className="pillar p1" />
            <div className="pillar p2" />
            <div className="torch t1" />
            <div className="torch t2" />
          </div>
          <div
            className={`fighter player-fighter ${battle.action === "attack" ? "is-attacking" : ""}`}
          >
            <div className="combat-hp">
              <span>ROOK</span>
              <div>
                <i style={{ width: `${(battle.playerHp / maxHealth) * 100}%` }} />
              </div>
              <b>
                {battle.playerHp}/{maxHealth}
              </b>
            </div>
            <Character skin={save.skin} action={battle.action} facing="back" />
          </div>
          <div
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
              <button className="test-ko-button" disabled={!!battle.result} onClick={testClearBoss}>
                TEST: BOSS HP = 0
              </button>
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
                disabled={battle.busy || battle.charge < 3}
                onClick={() => battleTurn("special")}
              >
                <b>SPECIAL</b>
                <span className="charge-meter">
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={battle.charge >= n ? "charged" : ""} />
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
                          {battle.boss === "shellback" ? "ALL ARENAS CLEARED" : "BOSS UNLOCKED"}
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
                      {battle.boss === "slime"
                        ? "The Stone Golem encounter is now available at the arena gate."
                        : battle.boss === "golem"
                          ? "The Frost Owl encounter is now available at the arena gate."
                          : battle.boss === "owl"
                            ? "The final Ancient Shellback encounter is now available."
                            : "Every arena champion has been defeated."}
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
  );
}
