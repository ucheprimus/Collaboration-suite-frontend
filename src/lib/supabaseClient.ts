import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types"; // ✅ CORRECT

// ... rest of your code
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
  supabase?: ReturnType<typeof createClient<Database>>;
};

export const supabase =
  globalForSupabase.supabase ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
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

// ✅ Export helper types
export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];
  
export type Inserts<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];
  
export type Updates<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];