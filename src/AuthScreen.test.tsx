import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthScreen from "./AuthScreen";

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), reset: vi.fn(), login: vi.fn() }));
vi.mock("./lib/supabase", () => ({
  supabase: {}, loginWithUsername: mocks.login,
  requireSupabase: () => ({ auth: { signUp: mocks.signUp, resetPasswordForEmail: mocks.reset } }),
}));
let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<AuthScreen onGuest={() => {}} />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(item => item.textContent === text)!;
  await act(async () => button.click());
}
function fill(name: string, value: string) { host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value = value; }
async function submit() { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }

describe("account forms", () => {
  it.each(["SIGN UP", "Forgot password?"])("does not reuse the email field when returning from %s to login", async destination => {
    await click(destination);
    fill("email", "player@example.test");
    await click("LOG IN");
    const username = host.querySelector<HTMLInputElement>('input[name="username"]')!;
    expect(username.value).toBe("");
    expect(host.querySelector('input[name="email"]')).toBeNull();
    expect(username.autocomplete).toBe("username");
  });
  it("logs in with the username and password without requesting an email", async () => {
    mocks.login.mockResolvedValue(undefined);
    fill("username", "PlayerOne"); fill("password", "password123");
    await submit();
    expect(mocks.login).toHaveBeenCalledWith("PlayerOne", "password123");
    expect(host.querySelector('input[name="email"]')).toBeNull();
    expect(host.textContent).not.toContain("Continue with Google");
  });
  it("signs up with email, password, and username metadata", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [{ id: "new-account" }], email_confirmed_at: null } }, error: null });
    await click("SIGN UP");
    fill("username", "NewPlayer"); fill("email", "player@example.test"); fill("password", "password123");
    await submit();
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "player@example.test", password: "password123", options: { data: { username: "NewPlayer" }, emailRedirectTo: window.location.origin } });
    expect(host.textContent).toContain("Check your email");
  });
  it.each(["user_already_exists", "email_exists"])("explains an existing account when signup returns %s", async code => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: { code, message: "User already registered" } });
    await click("SIGN UP");
    fill("username", "ExistingPlayer"); fill("email", "existing@example.test"); fill("password", "password123");
    await submit();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("You already have an account. Please log in or reset your password.");
    expect(host.textContent).not.toContain("Check your email");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(host.querySelector('button[aria-pressed="true"]')!.textContent).toBe("SIGN UP");
    await click("LOG IN");
    expect(host.querySelector('input[name="email"]')).toBeNull();
  });
  it("recognizes an obscured duplicate signup response", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
    await click("SIGN UP");
    fill("username", "AnotherName"); fill("email", "existing@example.test"); fill("password", "password123");
    await submit();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("You already have an account. Please log in or reset your password.");
    expect(host.textContent).not.toContain("Check your email");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
  it("keeps the confirmation instructions for an account awaiting verification", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [{ id: "unconfirmed-account" }], email_confirmed_at: null } }, error: null });
    await click("SIGN UP");
    fill("username", "UnconfirmedPlayer"); fill("email", "unconfirmed@example.test"); fill("password", "password123");
    await submit();
    expect(host.textContent).toContain("Check your email");
    expect(host.textContent).not.toContain("You already have an account");
  });
  it("does not classify missing identities as a duplicate account", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: {} }, error: null });
    await click("SIGN UP");
    fill("username", "NewPlayer"); fill("email", "player@example.test"); fill("password", "password123");
    await submit();
    expect(host.textContent).toContain("Check your email");
  });
  it("preserves unrelated signup errors", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: new Error("Signup is temporarily unavailable.") });
    await click("SIGN UP");
    fill("username", "NewPlayer"); fill("email", "player@example.test"); fill("password", "password123");
    await submit();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Signup is temporarily unavailable.");
    expect(host.textContent).not.toContain("You already have an account");
  });
  it("shows login errors and lets the player retry", async () => {
    mocks.login.mockRejectedValue(new Error("Invalid username or password."));
    fill("username", "PlayerOne"); fill("password", "wrong");
    await submit();
    expect(host.querySelector('[role="status"]')!.textContent).toContain("Invalid username or password");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });
  it("requests password recovery with an explicit recovery URL", async () => {
    mocks.reset.mockResolvedValue({ error: null });
    await click("Forgot password?");
    fill("email", "player@example.test");
    await submit();
    expect(mocks.reset).toHaveBeenCalledWith("player@example.test", { redirectTo: `${window.location.origin}/?reset=1` });
    expect(host.textContent).toContain("If an account uses that email");
  });
});

describe("signup configuration", () => {
  it("handles immediate signup sessions without asking for an email confirmation", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { identities: [{ id: "new" }] }, session: { access_token: "test" } }, error: null });
    await click("SIGN UP");
    fill("username", "NewPlayer"); fill("email", "new@example.test"); fill("password", "password123");
    await submit();
    expect(host.textContent).toContain("Account created");
    expect(host.textContent).not.toContain("Check your email");
  });
  it("explains email throttling instead of reporting a connection failure", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: { code: "over_email_send_rate_limit", message: "email rate limit exceeded" } });
    await click("SIGN UP");
    fill("username", "NewPlayer"); fill("email", "new@example.test"); fill("password", "password123");
    await submit();
    expect(host.textContent).toContain("Email sending limit reached");
  });
});
