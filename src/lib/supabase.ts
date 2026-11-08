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
  const response = await fetch(`${url}/functions/v1/username-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ username: username.trim(), password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Unable to log in. Please try again.");
  if (!body?.access_token || !body?.refresh_token) throw new Error("The login service returned an invalid response.");
  const { error } = await client.auth.setSession(body);
  if (error) throw error;
}
