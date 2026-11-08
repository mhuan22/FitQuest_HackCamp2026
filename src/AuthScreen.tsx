import { useState, type FormEvent } from "react";
import hero from "./assets/characters/idle/model-01-a.png";
import companion from "./assets/characters/idle/model-02-a.png";
import { loginWithUsername, requireSupabase, supabase } from "./lib/supabase";

export default function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const signup = mode === "signup";
  const reset = mode === "reset";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setNotice("");
    try {
      const client = requireSupabase();
      const email = String(form.get("email") ?? "").trim();
      const username = String(form.get("username") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (reset) {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?reset=1` });
        if (error) throw error;
        setNotice("If an account uses that email, a password reset link will arrive shortly.");
      } else if (signup) {
        const { data, error } = await client.auth.signUp({
          email, password, options: { data: { username }, emailRedirectTo: window.location.origin },
        });
        const alreadyRegistered = "You already have an account. Please log in or reset your password.";
        if (error?.code === "user_already_exists" || error?.code === "email_exists") {
          setNotice(alreadyRegistered);
          return;
        }
        if (error) {
          if (error.message.toLowerCase().includes("database error")) {
            throw new Error("Account creation failed. The username may be taken, or account setup is incomplete. Try another username or contact support.");
          }
          throw error;
        }
        // With confirmation enabled, Supabase can obscure a duplicate account
        // as a successful signup whose returned user has no identities.
        if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
          setNotice(alreadyRegistered);
          return;
        }
        setNotice(data.session ? "Account created. Loading your adventure…" : "Check your email to confirm your account, then log in with your username and password.");
      } else {
        await loginWithUsername(username, password);
      }
    } catch (reason) {
      const code = reason && typeof reason === "object" && "code" in reason ? reason.code : undefined;
      setNotice(code === "over_email_send_rate_limit"
        ? "Email sending limit reached. Try again later, or log in with an existing verified account."
        : reason instanceof Error ? reason.message : "Unable to connect. Please try again.");
    } finally { setPending(false); }
  }

  return (
    <main className="auth-screen">
      <div className="auth-layout">
        <section className="auth-intro" aria-labelledby="auth-brand">
          <span className="auth-eyebrow">A FITNESS ADVENTURE</span>
          <h1 id="auth-brand">FIT QUEST<span>Every rep.<br />A new level.</span></h1>
          <p>Train in the real world. Grow stronger in this one. Your adventure begins at the gym door.</p>
          <div className="auth-heroes" aria-hidden="true"><img src={hero} alt="" /><img src={companion} alt="" /></div>
          <div className="auth-quest"><span>YOUR FIRST QUEST</span><p>Show up. Get stronger. Take on the unknown.</p></div>
        </section>

        <section className="pixel-frame auth-card" aria-labelledby="auth-title">
          <div className="auth-card-top"><span>ADVENTURER’S GUILD</span><span aria-hidden="true">✦</span></div>
          <div className="auth-tabs" aria-label="Account options">
            <button type="button" disabled={pending} aria-pressed={mode === "login"} onClick={() => { setMode("login"); setNotice(""); }}>LOG IN</button>
            <button type="button" disabled={pending} aria-pressed={signup} onClick={() => { setMode("signup"); setNotice(""); }}>SIGN UP</button>
          </div>
          <h2 id="auth-title">{reset ? "Reset your password." : signup ? "Begin your story." : "Welcome back."}</h2>
          <p className="auth-subtitle">{reset ? "Enter the email you used to create your account." : signup ? "Create an account to save your adventure across devices." : "Log in with your adventurer username."}</p>
          <form key={mode} id={`fitquest-${mode}`} onSubmit={submit}>
            <fieldset disabled={pending} className="auth-fields">
              {(signup || reset) && <label className="auth-field">EMAIL<input id={`fitquest-${mode}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /><small>Used for account verification and password recovery.</small></label>}
              {!reset && <label className="auth-field">USERNAME<input id={`fitquest-${mode}-username`} name="username" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Your adventurer name" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title="Use 3–24 letters, numbers, or underscores" /></label>}
              {!reset && <label className="auth-field">PASSWORD
                <div className="auth-password"><input id={`fitquest-${mode}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Enter your password"} required minLength={signup ? 8 : 1} maxLength={1024} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "HIDE" : "SHOW"}</button></div>
              </label>}
              <button className="pixel-button primary auth-submit" type="submit">{pending ? "PLEASE WAIT…" : reset ? "SEND RESET LINK" : signup ? "CREATE ACCOUNT" : "LOG IN"}</button>
            </fieldset>
          </form>
          {!signup && !reset && <button className="auth-guest" type="button" disabled={pending} onClick={() => { setMode("reset"); setNotice(""); }}>Forgot password?</button>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {!supabase && <p className="auth-notice" role="status">Account services are not configured. Guest play is available.</p>}
          <button className="auth-guest" type="button" disabled={pending} onClick={onGuest}>Explore as a guest <span aria-hidden="true">↗</span></button>
          <p className="auth-local-note">Guest progress saves on this browser.</p>
        </section>
      </div>
      <footer className="auth-footer">TRAIN WITH PURPOSE <span>✦</span> PLAY FOR PROGRESS</footer>
    </main>
  );
}
