"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={loading}
      className="w-full"
    >
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}

