import { createClient } from "@supabase/supabase-js";

export function createServerSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
