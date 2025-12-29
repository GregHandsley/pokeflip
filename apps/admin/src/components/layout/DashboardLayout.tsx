"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/acquisitions", label: "Acquisitions" },
    { href: "/admin/inventory", label: "Inventory" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-black">Pokeflip Admin</h1>
          <p className="text-sm text-gray-600 mt-1">Sprint 1</p>
        </div>
        
        <nav className="flex-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname?.startsWith(item.href);
            
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-200">
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

