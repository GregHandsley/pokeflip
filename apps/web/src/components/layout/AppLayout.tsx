import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div className="h-screen w-screen grid" style={{ gridTemplateColumns: "16rem 1fr", gridTemplateRows: "3.5rem 1fr" }}>
      <div className="row-span-2">
        <Sidebar />
      </div>
      <div className="col-start-2">
        <Topbar />
      </div>
      <main className="col-start-2 overflow-auto bg-[rgb(var(--surface))]">
        <Outlet />
      </main>
    </div>
  );
}