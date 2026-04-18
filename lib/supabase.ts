import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type MediaType = "image" | "video";

export type Submission = {
  id: string;
  guest_name: string;
  challenge: string;
  caption: string | null;
  image_url: string;
  media_type: MediaType;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Log once on boot; individual calls will surface the missing config too.
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.",
  );
}

/**
 * Browser-safe Supabase client (uses the public anon key).
 * Safe to import in client components.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "http://localhost",
  supabaseAnonKey ?? "public-anon-key",
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  },
);

/**
 * Server-side Supabase client. Uses the service role key when available
 * (bypasses RLS for trusted inserts from the API route); otherwise falls
 * back to the anon key.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SUBMISSIONS_TABLE = "submissions";
