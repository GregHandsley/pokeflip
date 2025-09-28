import { NavLink } from "react-router-dom";
import { LayoutDashboard, Upload, Hourglass, Images, Tags, Package, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/uploads", label: "Uploads", icon: Upload },
  { to: "/pending", label: "Pending", icon: Hourglass },
  { to: "/cards", label: "Cards", icon: Images },
  { to: "/pricing", label: "Pricing", icon: Tags },
  { to: "/exports", label: "Exports", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="h-full w-64 border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="px-4 py-4">
        <div className="text-lg font-semibold">Pokeflip</div>
      </div>
      <nav className="px-2">
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-[rgb(var(--surface-alt))] text-[rgb(var(--ink))]",
                    isActive && "bg-[rgb(var(--surface-alt))] border border-[rgb(var(--border))]"
                  )
                }
                aria-label={label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}