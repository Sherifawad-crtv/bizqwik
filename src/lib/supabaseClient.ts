import { createClient } from "@supabase/supabase-js";

// Defaults point at "Bizqwik Test". Override per Vercel environment with
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (e.g. point Production at the
// "Bizqwik - Production" project) without touching this file.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://aylhnxniqrihpvrllpgz.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bGhueG5pcXJpaHB2cmxscGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODA3MTUsImV4cCI6MjEwNDM1NjcxNX0.Ww390hrJMxZIr1fLgxCpIWjbJAzCEaSut4gEFa_YvZ4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** The deployed edge function's slug — every route lives under this prefix. */
export const FN_SLUG = "make-server-980e1cbf";
