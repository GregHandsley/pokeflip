import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfigForServer } from "@/lib/config/env";

/**
 * Get the current user from a request
 * Attempts to extract user information from Authorization header or cookies
 */
export async function getCurrentUser(req: Request): Promise<{
  userId: string | null;
  userEmail: string | null;
} | null> {
  try {
    // Try to get session token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      // Create a Supabase client with the user's token
      const config = getSupabaseConfigForServer();
      const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        },
      });

      // Get user from token
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        return {
          userId: user.id,
          userEmail: user.email || null,
        };
      }
    }

    // Try to get session from cookies (if Supabase session is in cookies)
    // Supabase stores sessions in localStorage by default, so this might not work
    // But we'll try for future compatibility
    const cookies = req.headers.get("cookie");
    if (cookies) {
      // Extract session token from cookies if available
      // This is a placeholder - actual implementation depends on your cookie strategy
      // For now, we'll return null and rely on client passing user info explicitly
    }

    return null;
  } catch (error) {
    // If we can't get user, return null (not an error - might be public endpoint)
    return null;
  }
}

/**
 * Helper to create user info from explicit userId and userEmail
 * Use this when the client explicitly passes user information
 */
export function createUserInfo(userId?: string, userEmail?: string): {
  userId: string | null;
  userEmail: string | null;
} | null {
  if (!userId && !userEmail) {
    return null;
  }

  return {
    userId: userId || null,
    userEmail: userEmail || null,
  };
}

