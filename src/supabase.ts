import { createClient } from "@supabase/supabase-js";

// This project is a Vite + React app (not Next.js), so browser environment
// variables must use the VITE_ prefix. Supabase publishable keys are intended
// for browser use; database access is protected by Row Level Security (RLS).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("YOUR_PROJECT") &&
    !supabasePublishableKey.includes("YOUR_KEY"),
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
