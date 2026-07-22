import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminTopbar from "../components/admin/AdminTopbar";

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  useEffect(() => {
    const resize = () => {
      setScreenWidth(window.innerWidth);

      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const listener = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminSidebar
        open={sidebarOpen}
        collapsed={desktopCollapsed}
        closeSidebar={() => setSidebarOpen(false)}
      />

      <div
        className={`
          min-h-screen transition-all duration-300 ease-in-out
          ${desktopCollapsed ? "lg:ml-24" : "lg:ml-72"}
        `}
      >
        <AdminTopbar
          screenWidth={screenWidth}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          toggleCollapse={() => setDesktopCollapsed(!desktopCollapsed)}
          collapsed={desktopCollapsed}
        />

        <main className="space-y-8 p-5 text-slate-900 md:p-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
