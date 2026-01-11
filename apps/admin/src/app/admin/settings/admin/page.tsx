"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminTool {
  href: string;
  title: string;
  description: string;
  icon: string;
}

const adminTools: AdminTool[] = [
  {
    href: "/admin/settings/audit-trail",
    title: "Audit Trail",
    description: "View and manage audit logs, track changes, and undo actions",
    icon: "📋",
  },
  {
    href: "/admin/settings/integrity",
    title: "Data Integrity",
    description: "Run data validation checks, verify consistency, and validate calculations",
    icon: "🔍",
  },
  {
    href: "/admin/settings/backup",
    title: "Backup & Recovery",
    description: "Create backups, restore data, and manage system recovery",
    icon: "💾",
  },
  {
    href: "/admin/settings/performance",
    title: "Performance",
    description: "Monitor system health, view metrics, and track performance",
    icon: "📊",
  },
];

export default function AdminToolsPage() {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Tools</h1>
        <p className="text-gray-600">
          System administration tools for monitoring, maintenance, and data management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminTools.map((tool) => {
          const isActive = pathname === tool.href;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={`block p-6 rounded-lg border-2 transition-all hover:shadow-lg ${
                isActive
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{tool.icon}</div>
                <div className="flex-1">
                  <h2
                    className={`text-xl font-semibold mb-2 ${
                      isActive ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {tool.title}
                  </h2>
                  <p
                    className={`text-sm ${
                      isActive ? "text-gray-200" : "text-gray-600"
                    }`}
                  >
                    {tool.description}
                  </p>
                </div>
                <div
                  className={`text-sm font-medium ${
                    isActive ? "text-white" : "text-gray-400"
                  }`}
                >
                  →
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">About Admin Tools</h3>
        <p className="text-sm text-gray-600">
          These tools help you monitor system health, maintain data integrity, track changes,
          and manage backups. Use them regularly to ensure your system is running smoothly.
        </p>
      </div>
    </div>
  );
}

