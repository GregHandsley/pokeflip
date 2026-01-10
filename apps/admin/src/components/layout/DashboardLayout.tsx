"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import LogoutButton from "./LogoutButton";
import ToastContainer from "@/components/ui/ToastContainer";
import { logger } from "@/lib/logger";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
  description?: string;
  badge?: number | null;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      logger.error("Failed to load inbox count", e);
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

  // Auto-expand settings if on a settings page
  useEffect(() => {
    if (pathname?.startsWith("/admin/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  const navItems: NavItem[] = [
    { 
      href: "/admin", 
      label: "Command Center", 
      exact: true,
      description: "Overview dashboard"
    },
    { 
      href: "/admin/inventory", 
      label: "Inventory", 
      description: "View all cards"
    },
    { 
      href: "/admin/sales", 
      label: "Sales & Profit", 
      description: "View reports & analytics"
    },
    { 
      href: "/admin/acquisitions", 
      label: "Purchases", 
      description: "Step 1: Record purchases"
    },
    { 
      href: "/admin/inbox", 
      label: "Inbox", 
      description: "Step 2: List cards",
      badge: inboxCount
    },
    { 
      href: "/admin/record-sale", 
      label: "Record Sale", 
      description: "Step 3: Record sale"
    },
  ];

  const settingsItems = [
    { href: "/admin/settings/consumables", label: "Consumables" },
    { href: "/admin/settings/packaging-rules", label: "Packaging Rules" },
    { href: "/admin/settings/promotional-deals", label: "Promotional Deals" },
    { href: "/admin/settings/set-translations", label: "Set Translations" },
    { href: "/admin/settings/audit-trail", label: "Audit Trail" },
    { href: "/admin/settings/backup", label: "Backup & Recovery" },
    { href: "/admin/settings/performance", label: "Performance" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        id="sidebar-navigation"
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-40 ${
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
        aria-label="Main navigation"
      >
        <div className={`p-6 flex items-center ${sidebarOpen ? "justify-between" : "justify-center"}`}>
          {sidebarOpen ? (
            <>
              <div>
          <h1 className="text-xl font-bold text-black">Pokeflip Admin</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Collapse sidebar"
                aria-expanded="true"
                aria-controls="sidebar-navigation"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 min-w-[32px] min-h-[32px] flex items-center justify-center"
                aria-label="Expand sidebar"
                aria-expanded="false"
                aria-controls="sidebar-navigation"
              >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
        
        <nav className="flex-1 overflow-y-auto" aria-label="Main navigation">
          {/* Main Navigation Group: Command Center, Inventory, Sales & Profit */}
          {navItems.slice(0, 3).map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-6 py-3 text-sm font-medium transition-colors relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={sidebarOpen ? undefined : item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {sidebarOpen ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                    </div>
                    {item.description && (
                      <div className={`text-xs mt-0.5 leading-tight ${
                        isActive ? "text-gray-300" : "text-gray-500"
                      }`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center relative">
                    <span className="text-lg">{item.label.charAt(0)}</span>
                  </div>
                )}
              </a>
            );
          })}

          {/* Divider */}
          {sidebarOpen && <div className="px-6 py-2"><div className="border-t border-gray-200"></div></div>}

          {/* Workflow Steps: Purchases, Inbox, Record Sale */}
          {navItems.slice(3, 6).map((item, index) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            
            const isInbox = item.href === "/admin/inbox";
            const showBadge = isInbox && item.badge !== null && item.badge !== undefined && item.badge > 0;
            const badgeCount = item.badge || inboxCount;
            
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-6 py-3 text-sm font-medium transition-colors relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={sidebarOpen ? undefined : item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {sidebarOpen ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      {showBadge && (
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isActive
                            ? "bg-white text-black"
                            : "bg-blue-600 text-white"
                        }`}>
                          {badgeCount}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div className={`text-xs mt-0.5 leading-tight ${
                        isActive ? "text-gray-300" : "text-gray-500"
                      }`}>
                        {item.description}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-center relative">
                    <span className="text-lg">{item.label.charAt(0)}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">{badgeCount! > 99 ? '99+' : badgeCount}</span>
                      </span>
                    )}
                  </div>
                )}
              </a>
            );
          })}

          {/* Divider */}
          {sidebarOpen && <div className="px-6 py-2"><div className="border-t border-gray-200"></div></div>}

          {/* Settings Section - Collapsible */}
          {sidebarOpen && (
            <div className="px-6">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Settings
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {settingsOpen && (
                <div className="mt-1 space-y-1">
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
              className="w-full p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 min-h-[36px] flex items-center justify-center"
              title="Logout"
              aria-label="Log out of your account"
            >
              <svg
                className="w-5 h-5 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
          className="fixed left-4 top-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Open sidebar"
          aria-expanded="false"
          aria-controls="sidebar-navigation"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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

      {/* Skip to main content link */}
      <a 
        href="#main-content" 
        className="skip-to-main"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      {/* Main content */}
      <main 
        id="main-content"
        className={`transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-0"} min-w-0`}
        role="main"
        aria-label="Main content"
      >
        <div className="p-4 md:p-6 max-w-full overflow-x-auto">
          {children}
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

