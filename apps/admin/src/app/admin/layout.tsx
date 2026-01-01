"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login?next=" + encodeURIComponent(pathname || "/admin"));
      } else {
        setLoading(false);
      }
    });
  }, [router, supabase, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

