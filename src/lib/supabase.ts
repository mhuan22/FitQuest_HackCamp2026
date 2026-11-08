import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Guests can still play when a developer hasn't configured Supabase yet.
export const supabase = url && key ? createClient(url, key) : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Account services are not configured. Set the Supabase URL and publishable key, then restart Vite.");
  return supabase;
}

export async function loginWithUsername(username: string, password: string) {
  const client = requireSupabase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let body;
  try {
    const response = await fetch(`${url}/functions/v1/username-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ username: username.trim(), password }),
    signal: controller.signal,
    });
    body = await response.json();
    if (!response.ok) throw new Error(body?.error || "Unable to log in. Please try again.");
  } catch (reason) {
    if (controller.signal.aborted) throw new Error("The login service took too long to respond. Please try again in a moment.");
    throw reason;
  } finally { clearTimeout(timeout); }
  if (!body?.access_token || !body?.refresh_token) throw new Error("The login service returned an invalid response.");
  const { error } = await client.auth.setSession(body);
  if (error) throw error;
}
