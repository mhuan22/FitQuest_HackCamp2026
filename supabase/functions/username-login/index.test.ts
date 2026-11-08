// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Execute the production handler with fake Supabase clients. Only the npm import
// is replaced; passwords and sessions never reach a live project in these tests.
const rate = vi.fn();
const lookup = vi.fn();
const getUser = vi.fn();
const authenticate = vi.fn();
const admin = {
  rpc: rate,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: lookup }) }) }),
  auth: { admin: { getUserById: getUser } },
};
let handler: (request: Request) => Promise<Response>;
beforeAll(async () => {
  vi.stubGlobal("__fitquestCreateClient", (_url: string, key: string) => key === "admin-key" ? admin : { auth: { signInWithPassword: authenticate } });
  vi.stubGlobal("Deno", {
    serve: (callback: typeof handler) => { handler = callback; },
    env: { get: (name: string) => ({ SUPABASE_URL: "https://project.example.test", SUPABASE_SERVICE_ROLE_KEY: "admin-key", SUPABASE_ANON_KEY: "public-key" })[name] },
  });
  const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8")
    .replace(/^import .*?;\r?\n/, "const createClient = globalThis.__fitquestCreateClient;\n");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  new Function(compiled)();
});
beforeEach(() => {
  vi.clearAllMocks();
  rate.mockResolvedValue({ data: true, error: null });
  lookup.mockResolvedValue({ data: { user_id: "account-a" }, error: null });
  getUser.mockResolvedValue({ data: { user: { email: "private@example.test" } }, error: null });
  authenticate.mockResolvedValue({ data: { session: { access_token: "access", refresh_token: "refresh" } }, error: null });
});
const request = (username = "PlayerOne", password = "password123") => new Request("https://project.example.test/functions/v1/username-login", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.1" }, body: JSON.stringify({ username, password }),
});

describe("username login Edge Function", () => {
  it("returns session tokens without exposing the private email or password", async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: "access", refresh_token: "refresh" });
    expect(authenticate).toHaveBeenCalledWith({ email: "private@example.test", password: "password123" });
    expect(rate).toHaveBeenCalledWith("consume_login_attempt", { p_username: "playerone", p_ip: "192.0.2.1" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("gives unknown usernames and bad passwords the same public error", async () => {
    lookup.mockResolvedValueOnce({ data: null, error: null });
    const missing = await handler(request());
    authenticate.mockResolvedValueOnce({ data: { session: null }, error: new Error("bad password") });
    const incorrect = await handler(request());
    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(await missing.json()).toEqual(await incorrect.json());
  });
  it("fails closed when throttled or when the limiter is unavailable", async () => {
    rate.mockResolvedValueOnce({ data: false, error: null });
    expect((await handler(request())).status).toBe(429);
    rate.mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });
    expect((await handler(request())).status).toBe(503);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it("handles preflight and rejects unsupported methods", async () => {
    expect((await handler(new Request("https://example.test", { method: "OPTIONS" }))).status).toBe(200);
    expect((await handler(new Request("https://example.test"))).status).toBe(405);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
