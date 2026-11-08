import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import Game from "./App";
import AuthScreen from "./AuthScreen";
import { loadCloudSave } from "./game/cloudSave";
import { requireSupabase, supabase } from "./lib/supabase";

function AccountPanel({ children }: { children: ReactNode }) {
  return <main className="account-screen"><section className="pixel-frame account-panel">{children}</section></main>;
}

export default function AccountApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(!!supabase);
  const [guest, setGuest] = useState(false);
  const [recovery, setRecovery] = useState(() => new URLSearchParams(window.location.search).get("reset") === "1");
  const [loaded, setLoaded] = useState<(Awaited<ReturnType<typeof loadCloudSave>> & { userId: string }) | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [passwordPending, setPasswordPending] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next);
      setInitializing(false);
      if (next) setGuest(false);
      if (!next) setLoaded(null);
    });
    void supabase.auth.getSession().then(({ error: authError }) => {
      if (active && authError) { setError(authError.message); setInitializing(false); }
    }).catch(() => {
      if (active) { setError("Unable to restore your account session. Reload to try again."); setInitializing(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || recovery) return;
    let active = true;
    setLoaded(null);
    setError("");
    void loadCloudSave(userId).then(result => {
      if (active) setLoaded({ ...result, userId });
    }).catch(() => {
      if (active) setError("Unable to load your cloud progress. Check your connection and make sure the database migration has been applied. Your save has not been replaced.");
    });
    return () => { active = false; };
  }, [userId, attempt, recovery]);

  async function logout() {
    setError("");
    try {
      if (supabase && session) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) throw signOutError;
      }
    } catch {
      setError("Unable to log out. Check your connection and try again.");
      return;
    }
    setSession(null);
    setLoaded(null);
    setGuest(false);
    setRecovery(false);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== form.get("confirmation")) { setError("The passwords do not match."); return; }
    setPasswordPending(true);
    setError("");
    try {
      const { error: updateError } = await requireSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      window.history.replaceState(null, "", window.location.pathname);
      setRecovery(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reset password."); }
    finally { setPasswordPending(false); }
  }

  if (initializing) return <AccountPanel><h1>Restoring your session…</h1></AccountPanel>;
  if (recovery) return <AccountPanel>
    <h1>Choose a new password</h1>
    {session ? <form onSubmit={changePassword}><fieldset className="auth-fields" disabled={passwordPending}>
      <label className="auth-field">NEW PASSWORD<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} /></label>
      <label className="auth-field">CONFIRM PASSWORD<input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} /></label>
      <button className="pixel-button primary" type="submit">{passwordPending ? "SAVING…" : "UPDATE PASSWORD"}</button>
    </fieldset></form> : <p>This recovery link is invalid or expired. Return to login and request a new link.</p>}
    {error && <p role="alert">{error}</p>}
    <button className="auth-guest" disabled={passwordPending} onClick={() => void logout()}>Return to login</button>
  </AccountPanel>;
  if (session) {
    if (!loaded || loaded.userId !== session.user.id) return <AccountPanel>
      <h1>{error ? "Cloud save unavailable" : "Loading your adventure…"}</h1>
      {error && <><p role="alert">{error}</p><button className="pixel-button" onClick={() => setAttempt(n => n + 1)}>RETRY</button></>}
      <button className="auth-guest" onClick={() => void logout()}>Log out</button>
    </AccountPanel>;
    return <Game key={`${loaded.userId}:${attempt}`} userId={loaded.userId} username={loaded.username}
      initialSave={loaded.save} initialRevision={loaded.revision} onLogout={logout}
      onReload={() => { setLoaded(null); setAttempt(n => n + 1); }} accountError={error} />;
  }
  if (guest) return <Game key="guest" onLogout={logout} onReload={() => window.location.reload()} />;
  return <>{error && <p className="account-notice" role="alert">{error}</p>}<AuthScreen onGuest={() => { setError(""); setGuest(true); }} /></>;
}
