import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Creates a Supabase client for browser use
 * Only uses public environment variables (accessible on the client)
 */
export const supabaseBrowser = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Direct access to public env vars (client-safe)
  // Next.js injects NEXT_PUBLIC_* vars at build time
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Validate that required public variables are available
  // These must be set for the app to function
  if (!url || !key) {
    const errorMessage =
      "Missing required Supabase environment variables:\n" +
      "  - NEXT_PUBLIC_SUPABASE_URL\n" +
      "  - NEXT_PUBLIC_SUPABASE_ANON_KEY\n\n" +
      "Please:\n" +
      "  1. Copy .env.example to .env.local\n" +
      "  2. Fill in your Supabase credentials\n" +
      "  3. Restart the development server\n\n" +
      "See ENV_CONFIG.md for detailed setup instructions.";
    
    // In development, show helpful error
    if (process.env.NODE_ENV === "development") {
      console.error("❌ " + errorMessage);
    }
    
    throw new Error(errorMessage);
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });

  return supabaseClient;
};

