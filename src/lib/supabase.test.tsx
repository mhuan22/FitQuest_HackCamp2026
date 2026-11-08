import { afterEach, expect, it, vi } from "vitest";

const { setSession } = vi.hoisted(() => ({ setSession: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { setSession } }) }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("aborts a stalled login and never installs a session", async () => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.test");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  setSession.mockClear();
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  })));
  const { loginWithUsername } = await import("./supabase");
  const result = expect(loginWithUsername("Player", "password")).rejects.toThrow("login service took too long");
  await vi.advanceTimersByTimeAsync(15000);
  await result;
  expect(setSession).not.toHaveBeenCalled();
});
