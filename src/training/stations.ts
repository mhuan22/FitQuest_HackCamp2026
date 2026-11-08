import type { StatKey } from "../game/progression";
import type { ExerciseId } from "../vision/WorkoutCamera";

export type StationKey = "curls" | "squats" | "situps" | "treadmill";
export type CharacterAction = "idle" | "walk" | "curl" | "squat" | "situp" | "attack" | "guard" | "hit";
type Station = {
  stat: StatKey;
  tracking: ExerciseId;
  name: string;
  exercise: string;
  description: string;
  action: CharacterAction;
  position: { x: number; y: number };
};

export const STATIONS: Record<StationKey, Station> = {
  curls: {
    stat: "strength",
    tracking: "curl",
    name: "Dumbbell Rack",
    exercise: "Biceps Curls",
    description: "Curl with control. Keep your elbows close and finish every rep.",
    action: "curl",
    position: { x: 19, y: 57 },
  },
  squats: {
    stat: "agility",
    tracking: "squat",
    name: "Squat Mat",
    exercise: "Bodyweight Squats",
    description: "Lower to depth, keep your chest tall, then stand with purpose.",
    action: "squat",
    position: { x: 82, y: 55 },
  },
  situps: {
    stat: "defense",
    tracking: "situp",
    name: "Sit-up Bench",
    exercise: "Core Sit-ups",
    description: "Brace your core, lower with control, and rise until your torso is upright.",
    action: "situp",
    position: { x: 28, y: 79 },
  },
  treadmill: {
    stat: "health",
    tracking: "run",
    name: "Treadmill",
    exercise: "Treadmill Run",
    description: "Keep a steady rhythm, land softly, and maintain your pace until you reach your active-time goal.",
    action: "walk",
    position: { x: 72, y: 79 },
  },
};

export const RUN_BLOCK_SECONDS = 30;
export const XP_PER_UNIT = 10;
