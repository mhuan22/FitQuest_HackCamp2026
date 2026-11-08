import { useEffect, useRef, useState } from "react";
import { requireSupabase } from "../lib/supabase";
import { demoReport, type StationTotal } from "./guildTraining";
import { STATIONS } from "./stations";

const WEEKLY_GOAL = 500;

export function GuildTrainingReport({ demo, sync, syncError, onClose }: {
  demo: boolean;
  sync: () => Promise<void>;
  syncError: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  const [refresh, setRefresh] = useState(0);
  const [totals, setTotals] = useState<StationTotal[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setTotals(null);
    setError("");
    async function load() {
      if (demo) return demoReport();
      await sync();
      const { data, error } = await requireSupabase().functions.invoke<{ totals: StationTotal[] }>("guild-training-report");
      if (error || !data) throw new Error("Unable to load the guild report.");
      return data.totals;
    }
    void load().then(result => {
      if (active) setTotals(result);
    }).catch(() => {
      if (active) setError("The guild report is unavailable. Try refreshing.");
    });
    return () => { active = false; };
  }, [demo, refresh, sync]);

  const guildXp = totals?.reduce((sum, row) => sum + row.guildXp, 0) ?? 0;
  const playerXp = totals?.reduce((sum, row) => sum + row.playerXp, 0) ?? 0;
  const favorite = totals?.reduce<StationTotal | undefined>((best, row) =>
    row.playerXp > (best?.playerXp ?? 0) ? row : best, undefined);

  return (
    <dialog ref={dialog} className="pixel-frame guild-report" aria-labelledby="guild-report-title"
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <h2 id="guild-report-title">Guild Training Report</h2>
      <p>{demo ? "Local demo · simulated workouts count" : "Powered by Databricks · all FitQuest adventurers"}</p>
      <p>Weekly challenge · Resets Monday at 00:00 UTC</p>
      {syncError && <p role="status">{syncError}</p>}
      {error && <p role="alert">{error}</p>}
      {!totals && !error && <p role="status">Loading guild progress…</p>}
      {totals && (
        <>
          <p><strong>{guildXp.toLocaleString()} / {WEEKLY_GOAL} guild XP</strong>{guildXp >= WEEKLY_GOAL && " · Goal reached!"}</p>
          <progress aria-label="Weekly guild XP goal" value={Math.min(guildXp, WEEKLY_GOAL)} max={WEEKLY_GOAL} />
          <p>Your contribution · <strong>{playerXp.toLocaleString()} XP</strong></p>
          {favorite && <p>Your top exercise by XP · {STATIONS[favorite.station].exercise}</p>}
          {!totals.length && <p>Complete a workout to start this week’s challenge.</p>}
          {!!totals.length && (
            <ul>
              {totals.map(row => <li key={row.station}>{STATIONS[row.station].exercise} · {row.guildXp.toLocaleString()} guild XP</li>)}
            </ul>
          )}
        </>
      )}
      <div className="dialog-actions">
        <button className="pixel-button" disabled={!totals && !error} onClick={() => setRefresh(value => value + 1)}>Refresh</button>
        <button className="pixel-button primary" onClick={onClose} autoFocus>Close</button>
      </div>
    </dialog>
  );
}
