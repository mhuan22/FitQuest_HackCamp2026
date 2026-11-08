// Tests the real migration in a disposable PostgreSQL cluster, never the hosted
// project. Requires PostgreSQL's initdb/pg_ctl/psql on PATH, or PG_BIN set.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const scratch = mkdtempSync(join(tmpdir(), "fitquest-db-test-"));
const cluster = join(scratch, "data");
const bin = process.env.PG_BIN;
const command = name => bin ? join(bin, name + (process.platform === "win32" ? ".exe" : "")) : name;
const run = (name, args, input) => {
  // Windows' detached postgres process can inherit pg_ctl's pipes and keep a
  // synchronous caller waiting forever after pg_ctl exits. Do not pipe pg_ctl.
  const result = spawnSync(command(name), args, {
    input, encoding: "utf8", windowsHide: true, timeout: 60000,
    stdio: name === "pg_ctl" ? "ignore" : [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
};
const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolvePort(port));
  });
});
let started = false;
try {
  run("initdb", ["-D", cluster, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  run("pg_ctl", ["-D", cluster, "-l", join(scratch, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  started = true;
  const args = ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
  run("psql", args, `
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  run("psql", [...args, "-f", resolve("supabase/migrations/202611080001_accounts_and_progress.sql")]);
  const output = run("psql", [...args, "-f", resolve("supabase/tests/accounts.sql")]);
  console.log(output.trim());
  console.log("Database tests passed: ownership, initialization, validation, retries, conflicts, and login throttling.");
} finally {
  if (started) run("pg_ctl", ["-D", cluster, "-m", "immediate", "-w", "stop"]);
  // scratch is an absolute, OS-created temporary directory owned by this test.
  if (resolve(scratch).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/"))) {
    rmSync(scratch, { recursive: true, force: true });
  }
}
