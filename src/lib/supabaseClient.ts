// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,       // ✅ keep session in localStorage
      autoRefreshToken: true,     // ✅ refresh token automatically
      detectSessionInUrl: true,   // ✅ handle redirects (for OAuth too)
    },
  }
);
