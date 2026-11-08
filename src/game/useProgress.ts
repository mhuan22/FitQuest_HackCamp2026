import { useCallback, useEffect, useRef, useState } from "react";
import { loadSave, normalizeSave, type SaveData } from "./progression";
import { saveCloudProgress, SaveConflictError } from "./cloudSave";
import { readRecovery, writeRecovery, clearRecovery, type PendingSave } from "./saveRecovery";

export function useProgress(userId: string | undefined, initialSave: SaveData | undefined, initialRevision: number, storageKey = "ironvale-save") {
  const [initial] = useState(() => {
    if (userId && !initialSave) throw new Error("Account progress must finish loading before the game starts.");
    const cloud = initialSave ? normalizeSave(initialSave) : loadSave(storageKey);
    const recovery = userId ? readRecovery(userId) : null;
    // An upload whose response was lost may already be in the cloud. Keep
    // retrying that exact mutation so the server can acknowledge it safely.
    const mayBeAcknowledged = recovery && initialRevision === recovery.revision + 1 &&
      JSON.stringify(cloud) === JSON.stringify(recovery.save);
    const conflict = !!recovery && recovery.revision !== initialRevision && !mayBeAcknowledged;
    return { cloud, recovery, conflict };
  });
  const [save, setSave] = useState(() => initial.recovery?.latestSave ?? initial.recovery?.save ?? initial.cloud);
  const [status, setStatus] = useState<"saved" | "saving" | "error" | "conflict">(initial.conflict ? "conflict" : initial.recovery ? "saving" : "saved");
  const [error, setError] = useState(initial.conflict
    ? `This device has a pending save from revision ${initial.recovery!.revision}, but your account is now at revision ${initialRevision}. Reload the cloud save to continue.` : "");
  const [needsAttention, setNeedsAttention] = useState(initial.conflict);
  const current = useRef(save);
  const confirmed = useRef(JSON.stringify(initial.cloud));
  const revision = useRef(initial.recovery?.revision ?? initialRevision);
  const pending = useRef<PendingSave | null>(initial.recovery);
  const running = useRef(false);
  const blocked = useRef(initial.conflict);
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
        pending.current ??= { save: current.current, id: userId ? crypto.randomUUID() : "guest", revision: revision.current };
        const mutation = pending.current;
        setStatus("saving");
        if (userId) {
          // Keep the exact request (including its original revision and UUID)
          // until acknowledged. A reload can safely retry an uncertain upload.
          writeRecovery(userId, { ...mutation, latestSave: current.current });
          revision.current = await saveCloudProgress(mutation.save, mutation.revision, mutation.id);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(mutation.save));
        }
        if (!alive.current) return;
        confirmed.current = JSON.stringify(mutation.save);
        pending.current = null;
        if (userId) clearRecovery(userId);
      }
      if (alive.current) { setStatus("saved"); setError(""); setNeedsAttention(false); }
    } catch (reason) {
      if (!alive.current) return;
      blocked.current = true;
      setNeedsAttention(true);
      setStatus(reason instanceof SaveConflictError ? "conflict" : "error");
      setError(reason && typeof reason === "object" && "message" in reason ? String(reason.message) : "Progress could not be saved. Check your connection and retry.");
    } finally { running.current = false; }
  }, [userId, storageKey]);

  useEffect(() => {
    current.current = save;
    // A stale recovery is handled by the conflict flow. In StrictMode this
    // effect runs again after that flow archives the pending request; writing
    // it here would resurrect the stale save and cause a reload loop.
    if (initial.conflict) return;
    try {
      if (userId && pending.current) writeRecovery(userId, { ...pending.current, latestSave: save });
    } catch {
      blocked.current = true;
      setNeedsAttention(true);
      setStatus("error");
      setError("Unable to keep a recovery copy. Free some browser storage, then retry saving.");
      return;
    }
    void flush();
  }, [save, flush, userId, initial.conflict]);
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
  useEffect(() => {
    const reconnect = () => {
      if (!blocked.current) return;
      // Conflicts need an explicit reload, never an automatic overwrite.
      if (status !== "conflict") { blocked.current = false; void flush(); }
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [flush, status]);

  const visibleStatus = status === "saved" && JSON.stringify(save) !== confirmed.current ? "saving" : status;
  return {
    save, setSave, status: visibleStatus, error, blocked: needsAttention,
    retry: () => { if (status !== "conflict") { blocked.current = false; void flush(); } },
    discardRecovery: () => { if (userId) clearRecovery(userId); },
  };
}
