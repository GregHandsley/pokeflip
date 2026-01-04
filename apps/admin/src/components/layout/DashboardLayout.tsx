"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import LogoutButton from "./LogoutButton";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  const handleLogout = async () => {
    setLogoutLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Load inbox count
  const loadInboxCount = async () => {
    try {
      const res = await fetch("/api/admin/inbox/count");
      const json = await res.json();
      if (json.ok) {
        setInboxCount(json.count);
      }
    } catch (e) {
      console.error("Failed to load inbox count:", e);
    }
  };

  useEffect(() => {
    loadInboxCount();
    
    // Listen for inbox update events
    const handleInboxUpdate = () => {
      // Small delay to allow database operations to complete
      setTimeout(loadInboxCount, 500);
    };
    
    window.addEventListener("inboxUpdated", handleInboxUpdate);
    
    return () => {
      window.removeEventListener("inboxUpdated", handleInboxUpdate);
    };
  }, []);

  // Refresh count when navigating to/from inbox page
  useEffect(() => {
    if (pathname === "/admin/inbox" || pathname?.startsWith("/admin/inbox")) {
      // Small delay to allow inbox operations to complete
      const timeout = setTimeout(loadInboxCount, 1000);
      return () => clearTimeout(timeout);
    }
  }, [pathname]);

  const navItems = [
    { href: "/admin", label: "Command Center", exact: true },
    { href: "/admin/acquisitions", label: "Purchases" },
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/bundles", label: "Bundles" },
    { href: "/admin/inbox", label: "Inbox" },
    { href: "/admin/sales", label: "Sales & Profit" },
  ];

  const settingsItems = [
    { href: "/admin/settings/consumables", label: "Consumables" },
    { href: "/admin/settings/packaging-rules", label: "Packaging Rules" },
    { href: "/admin/settings/promotional-deals", label: "Promotional Deals" },
    { href: "/admin/settings/set-translations", label: "Set Translations" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-40 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className={`p-6 flex items-center ${sidebarOpen ? "justify-between" : "justify-center"}`}>
          {sidebarOpen ? (
            <>
              <div>
          <h1 className="text-xl font-bold text-black">Pokeflip Admin</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Collapse sidebar"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Expand sidebar"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            
            const isInbox = item.href === "/admin/inbox";
            const showBadge = isInbox && inboxCount !== null && inboxCount > 0;
            
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-6 py-3 text-sm font-medium transition-colors relative ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={sidebarOpen ? undefined : item.label}
              >
                {sidebarOpen ? (
                  <div className="flex items-center justify-between">
                    <span>{item.label}</span>
                    {showBadge && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-white text-black"
                          : "bg-blue-600 text-white"
                      }`}>
                        {inboxCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center relative">
                    <span className="text-lg">{item.label.charAt(0)}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">{inboxCount! > 99 ? '99+' : inboxCount}</span>
                      </span>
                    )}
                  </div>
                )}
              </a>
            );
          })}
          
          {/* Settings Section */}
          {sidebarOpen && (
            <div className="mt-4 px-6">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Settings
              </div>
              {settingsItems.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-2 text-sm font-medium transition-colors rounded ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          )}
        </nav>

        <div className={`p-6 border-t border-gray-200 ${!sidebarOpen ? "px-2" : ""}`}>
          {sidebarOpen ? (
          <LogoutButton />
          ) : (
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="w-full p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Logout"
            >
              <svg
                className="w-5 h-5 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Sidebar toggle button (when closed) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          aria-label="Open sidebar"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Main content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-0"}`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

