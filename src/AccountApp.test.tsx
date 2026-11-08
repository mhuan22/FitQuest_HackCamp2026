import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import AccountApp from "./AccountApp";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), subscribe: vi.fn(), signOut: vi.fn(), updateUser: vi.fn(), load: vi.fn() }));
vi.mock("./lib/supabase", () => {
  const client = { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.subscribe, signOut: mocks.signOut, updateUser: mocks.updateUser } };
  return { supabase: client, requireSupabase: () => client };
});
vi.mock("./game/cloudSave", () => ({ loadCloudSave: mocks.load }));
vi.mock("./AuthScreen", () => ({ default: ({ onGuest }: { onGuest: () => void }) => <button onClick={onGuest}>Enter guest</button> }));
vi.mock("./App", () => ({ default: ({ userId, initialSave, onLogout, accountError }: {
  userId?: string; initialSave?: { strengthXp: number }; onLogout: () => void; accountError?: string;
}) => <div data-testid="game">{userId ?? "guest"} XP:{initialSave?.strengthXp ?? "local"}<button onClick={onLogout}>Log out</button>{accountError}</div> }));

let root: Root;
let host: HTMLDivElement;
let listener: (event: AuthChangeEvent, session: Session | null) => void;
const session = (id: string) => ({ user: { id } }) as Session;
const result = (xp: number) => ({ save: { strengthXp: xp }, revision: 0, username: "Player" });
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
  mocks.getSession.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.subscribe.mockImplementation(callback => {
    listener = callback;
    queueMicrotask(() => callback("INITIAL_SESSION", null));
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const mount = () => act(async () => root.render(<AccountApp />));
const emit = (event: AuthChangeEvent, value: Session | null) => act(async () => listener(event, value));

describe("session and save loading", () => {
  it("waits for the cloud save and restores a session after refresh", async () => {
    let finish!: (value: ReturnType<typeof result>) => void;
    mocks.load.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mocks.subscribe.mockImplementation(callback => {
      listener = callback;
      queueMicrotask(() => callback("INITIAL_SESSION", session("a")));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    await mount();
    expect(host.textContent).toContain("Loading your adventure");
    expect(host.querySelector('[data-testid="game"]')).toBeNull();
    await act(async () => finish(result(50)));
    expect(host.textContent).toContain("a XP:50");
  });

  it("never carries account A progress into account B or guest mode", async () => {
    mocks.load.mockResolvedValueOnce(result(100)).mockResolvedValueOnce(result(0));
    await mount();
    await emit("SIGNED_IN", session("a"));
    expect(host.textContent).toContain("a XP:100");
    await emit("SIGNED_OUT", null);
    expect(host.textContent).not.toContain("XP:100");
    await emit("SIGNED_IN", session("b"));
    expect(host.textContent).toContain("b XP:0");
    await emit("SIGNED_OUT", null);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(host.textContent).toContain("guest XP:local");
  });

  it("does not replace a failed cloud load with an empty local save", async () => {
    mocks.load.mockRejectedValue(new Error("offline"));
    await mount();
    await emit("SIGNED_IN", session("a"));
    expect(host.textContent).toContain("Cloud save unavailable");
    expect(host.querySelector('[data-testid="game"]')).toBeNull();
  });

  it("shows a recovery form instead of entering the game", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.load.mockResolvedValue(result(50));
    await mount();
    await emit("PASSWORD_RECOVERY", session("a"));
    expect(host.textContent).toContain("Choose a new password");
    expect(mocks.load).not.toHaveBeenCalled();
    host.querySelector<HTMLInputElement>('[name="password"]')!.value = "new-password-123";
    host.querySelector<HTMLInputElement>('[name="confirmation"]')!.value = "new-password-123";
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    expect(host.textContent).toContain("a XP:50");
  });
});
