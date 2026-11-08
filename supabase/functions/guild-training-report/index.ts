import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const stations = ["curls", "squats", "situps", "treadmill"];

function config(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function databricksReport(playerId: string) {
  const host = new URL(config("DATABRICKS_HOST"));
  if (host.protocol !== "https:") throw new Error("Databricks requires HTTPS");
  const catalog = config("DATABRICKS_WORKOUT_CATALOG");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(catalog)) throw new Error("Invalid Databricks catalog");

  const auth = btoa(`${config("DATABRICKS_CLIENT_ID")}:${config("DATABRICKS_CLIENT_SECRET")}`);
  const tokenResponse = await fetch(new URL("/oidc/v1/token", host), {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "all-apis" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!tokenResponse.ok) throw new Error(`Databricks OAuth status ${tokenResponse.status}`);
  const { access_token: token } = await tokenResponse.json();

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const response = await fetch(new URL("/api/2.0/sql/statements", host), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      warehouse_id: config("DATABRICKS_WAREHOUSE_ID"),
      wait_timeout: "30s",
      on_wait_timeout: "CANCEL",
      statement: `
        SELECT station, SUM(xp), SUM(CASE WHEN player_key = :player THEN xp ELSE 0 END)
        FROM \`${catalog}\`.fitquest_reporting.workout_xp
        WHERE completed_at >= :week_start AND completed_at < :week_end
        GROUP BY station
        ORDER BY station`,
      parameters: [
        { name: "player", value: playerId },
        { name: "week_start", value: start.toISOString(), type: "TIMESTAMP" },
        { name: "week_end", value: end.toISOString(), type: "TIMESTAMP" },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`Databricks SQL status ${response.status}`);
  const result = await response.json();
  if (result.status?.state !== "SUCCEEDED") throw new Error(`Databricks statement state ${result.status?.state}`);
  const rows: string[][] = result.result?.data_array ?? [];
  return rows.map(([station, guild, player]) => {
    const guildXp = Number(guild);
    const playerXp = Number(player);
    if (!stations.includes(station) || !Number.isSafeInteger(guildXp) || !Number.isSafeInteger(playerXp)) {
      throw new Error("Unexpected Databricks report result");
    }
    return { station, guildXp, playerXp };
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  const jwt = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!jwt) return Response.json({ error: "Sign in required" }, { status: 401, headers });

  try {
    const supabase = createClient(config("SUPABASE_URL"), config("SUPABASE_ANON_KEY"));
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    if (error || !user || user.is_anonymous) {
      return Response.json({ error: "Sign in required" }, { status: 401, headers });
    }
    const totals = await databricksReport(user.id);
    return Response.json({ totals }, { headers });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Guild report failed");
    return Response.json({ error: "Guild report unavailable" }, { status: 503, headers });
  }
});
