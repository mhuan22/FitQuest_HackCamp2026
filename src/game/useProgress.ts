import { useCallback, useEffect, useRef, useState } from "react";
import { loadSave, type SaveData } from "./progression";
import { saveCloudProgress, SaveConflictError } from "./cloudSave";

export function useProgress(userId: string | undefined, initialSave: SaveData | undefined, initialRevision: number, modelCount: number) {
  const [save, setSave] = useState(() => initialSave ?? loadSave(modelCount));
  const [status, setStatus] = useState<"saved" | "saving" | "error" | "conflict">("saved");
  const [error, setError] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const current = useRef(save);
  const confirmed = useRef(JSON.stringify(save));
  const revision = useRef(initialRevision);
  const pending = useRef<{ save: SaveData; id: string } | null>(null);
  const running = useRef(false);
  const blocked = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const flush = useCallback(async () => {
    if (running.current || blocked.current || !alive.current) return;
    running.current = true;
    try {
      while (alive.current && (pending.current || JSON.stringify(current.current) !== confirmed.current)) {
        pending.current ??= { save: current.current, id: userId ? crypto.randomUUID() : "guest" };
        const mutation = pending.current;
        setStatus("saving");
        if (userId) {
          revision.current = await saveCloudProgress(mutation.save, revision.current, mutation.id);
        } else {
          localStorage.setItem("ironvale-save", JSON.stringify(mutation.save));
        }
        if (!alive.current) return;
        confirmed.current = JSON.stringify(mutation.save);
        pending.current = null;
      }
      if (alive.current) { setStatus("saved"); setError(""); setNeedsAttention(false); }
    } catch (reason) {
      if (!alive.current) return;
      blocked.current = true;
      setNeedsAttention(true);
      setStatus(reason instanceof SaveConflictError ? "conflict" : "error");
      setError(reason && typeof reason === "object" && "message" in reason ? String(reason.message) : "Progress could not be saved. Check your connection and retry.");
    } finally { running.current = false; }
  }, [userId]);

  useEffect(() => { current.current = save; void flush(); }, [save, flush]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || JSON.stringify(current.current) !== confirmed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const visibleStatus = status === "saved" && JSON.stringify(save) !== confirmed.current ? "saving" : status;
  return { save, setSave, status: visibleStatus, error, blocked: needsAttention, retry: () => { blocked.current = false; void flush(); } };
}
