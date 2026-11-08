import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const invalid = "Invalid username or password. Verify your email before logging in.";
const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  if (Number(request.headers.get("content-length")) > 4096) return reply({ error: "Request too large." }, 413);
  const started = Date.now();
  // Equalize ordinary failed lookups so the public endpoint does not disclose
  // whether a username exists through a fast missing-profile response.
  const denied = async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 750 - (Date.now() - started))));
    return reply({ error: invalid }, 401);
  };
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "Request too large." }, 413);
    const input = JSON.parse(text);
    if (typeof input.username !== "string" || typeof input.password !== "string") return denied();
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username) || !input.password || input.password.length > 1024) return denied();
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: rateError } = await admin.rpc("consume_login_attempt", {
      p_username: username,
      p_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    });
    if (rateError) return reply({ error: "Login is temporarily unavailable. Please try again." }, 503);
    if (!allowed) return reply({ error: "Too many login attempts. Please try again in 15 minutes." }, 429);
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("user_id").eq("normalized_username", username).maybeSingle();
    if (profileError) return reply({ error: "Login is temporarily unavailable. Please try again." }, 503);
    if (!profile) return denied();
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(profile.user_id);
    if (accountError || !account.user?.email) return denied();
    // A separate client prevents a successful login from replacing the admin
    // client's credentials. Passwords are verified only by Supabase Auth.
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.signInWithPassword({ email: account.user.email, password: input.password });
    if (error || !data.session) return denied();
    return reply({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch {
    return reply({ error: "Unable to log in. Please try again." }, 400);
  }
});
