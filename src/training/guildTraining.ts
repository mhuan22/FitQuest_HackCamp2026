import { useCallback, useEffect, useRef, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import type { StationKey } from "./stations";

type Workout = {
  id: string;
  station: StationKey;
  reps: number | null;
  activeSeconds: number | null;
  xp: number;
  completedAt: string;
};

export type StationTotal = { station: StationKey; guildXp: number; playerXp: number };

const demoKey = "fitquest-guild-demo";
const pendingPrefix = (userId: string) => `fitquest-workout:${userId}:`;

function demoWorkouts(): Workout[] {
  return JSON.parse(localStorage.getItem(demoKey) ?? "[]");
}

export function clearDemoWorkouts() {
  localStorage.removeItem(demoKey);
}

export function demoReport(now = new Date()): StationTotal[] {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const totals = new Map<StationKey, StationTotal>();
  for (const workout of demoWorkouts()) {
    const completed = Date.parse(workout.completedAt);
    if (completed < start.getTime() || completed >= start.getTime() + 7 * 86400_000) continue;
    const total = totals.get(workout.station) ?? { station: workout.station, guildXp: 0, playerXp: 0 };
    total.guildXp += workout.xp;
    total.playerXp += workout.xp;
    totals.set(workout.station, total);
  }
  return [...totals.values()];
}

export function useGuildTraining(userId: string | undefined, demo: boolean) {
  const [syncError, setSyncError] = useState("");
  const uploading = useRef<Promise<void> | null>(null);

  const sync = useCallback(() => {
    if (!userId) return Promise.resolve();
    if (uploading.current) return uploading.current;
    const prefix = pendingPrefix(userId);
    uploading.current = Promise.resolve().then(async () => {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (!value) continue;
        const workout: Workout = JSON.parse(value);
        const { error } = await requireSupabase().rpc("record_workout", {
          session_id: workout.id,
          expected_player: userId,
          station_key: workout.station,
          rep_count: workout.reps,
          run_seconds: workout.activeSeconds,
          earned_xp: workout.xp,
        });
        if (error) throw error;
        localStorage.removeItem(key);
      }
      setSyncError("");
    }).catch(() => {
      setSyncError("Some workouts are waiting to sync. Refresh the report to retry.");
    }).finally(() => { uploading.current = null; });
    return uploading.current;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void sync();
    const retry = () => { void sync(); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [sync, userId]);

  const record = useCallback((station: StationKey, amount: number, xp: number) => {
    if (xp <= 0 || (!userId && !demo)) return;
    try {
      const workout: Workout = {
        id: crypto.randomUUID(),
        station,
        reps: station === "treadmill" ? null : amount,
        activeSeconds: station === "treadmill" ? Math.floor(amount / 1000) : null,
        xp,
        completedAt: new Date().toISOString(),
      };
      if (userId) {
        localStorage.setItem(pendingPrefix(userId) + workout.id, JSON.stringify(workout));
        // If an upload is already running, its snapshot may not include this workout.
        if (uploading.current) void uploading.current.then(sync);
        else void sync();
      } else {
        const weekAgo = Date.now() - 7 * 86400_000;
        const recent = demoWorkouts().filter(entry => Date.parse(entry.completedAt) >= weekAgo);
        localStorage.setItem(demoKey, JSON.stringify([...recent, workout]));
      }
    } catch {
      setSyncError("This workout could not be saved to the guild report on this device.");
    }
  }, [demo, sync, userId]);

  return { record, sync, syncError };
}
