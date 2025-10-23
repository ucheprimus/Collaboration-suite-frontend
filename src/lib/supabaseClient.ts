// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// ✅ Get env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ Safety check
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables!");
  console.log("VITE_SUPABASE_URL:", supabaseUrl);
  console.log("VITE_SUPABASE_ANON_KEY:", supabaseAnonKey?.slice(0, 10));
  throw new Error("Supabase environment variables not found");
}

// ✅ Hot-reload safe singleton (prevents multiple GoTrueClient instances)
const globalForSupabase = globalThis as unknown as {
  supabase?: ReturnType<typeof createClient>;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "supabase.auth.token",
    },
  });

if (!globalForSupabase.supabase) {
  globalForSupabase.supabase = supabase;
}
