import { useState, type FormEvent } from "react";
import hero from "./assets/characters/idle/model-01-a.png";
import companion from "./assets/characters/idle/model-02-a.png";

export default function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const signup = mode === "signup";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Account services are not connected yet. You can explore the game as a guest below.");
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
            <button type="button" aria-pressed={!signup} onClick={() => { setMode("login"); setNotice(""); }}>LOG IN</button>
            <button type="button" aria-pressed={signup} onClick={() => { setMode("signup"); setNotice(""); }}>SIGN UP</button>
          </div>
          <h2 id="auth-title">{signup ? "Begin your story." : "Welcome back."}</h2>
          <p className="auth-subtitle">{signup ? "A new adventurer. A whole world to grow into." : "Your next level is waiting for you."}</p>
          <button className="auth-oauth" type="button" onClick={() => setNotice("Google sign-in is not connected yet. Continue as a guest to try the game.")}><span aria-hidden="true">G</span>Continue with Google</button>
          <div className="auth-divider"><span>or use your username</span></div>
          <form onSubmit={submit}>
            <label className="auth-field">USERNAME<input name="username" autoComplete="username" placeholder="Your adventurer name" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title="Use 3–24 letters, numbers, or underscores" /></label>
            <label className="auth-field">PASSWORD
              <div className="auth-password"><input name="password" type={showPassword ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Enter your password"} required minLength={signup ? 8 : 1} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "HIDE" : "SHOW"}</button></div>
            </label>
            {signup && <label className="auth-field">GENDER <span className="auth-optional">OPTIONAL</span><select name="gender" defaultValue=""><option value="">Prefer not to say</option><option value="woman">Woman</option><option value="man">Man</option><option value="nonbinary">Non-binary</option><option value="self-described">Another identity</option></select><small>You can choose any character in the game.</small></label>}
            <button className="pixel-button primary auth-submit" type="submit">{signup ? "CREATE ACCOUNT" : "LOG IN"}<span aria-hidden="true"> →</span></button>
          </form>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <p className="auth-preview-note">Account preview · Sign-in services coming soon</p>
          <button className="auth-guest" type="button" onClick={onGuest}>Explore as a guest <span aria-hidden="true">↗</span></button>
          <p className="auth-local-note">Guest progress saves on this browser.</p>
        </section>
      </div>
      <footer className="auth-footer">TRAIN WITH PURPOSE <span>✦</span> PLAY FOR PROGRESS</footer>
    </main>
  );
}
