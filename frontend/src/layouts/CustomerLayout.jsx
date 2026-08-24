import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/customer/Sidebar";
import Topbar from "../components/customer/Topbar";
import NoCompanyState from "../components/customer/NoCompanyState";
import { useAuth } from "../context/AuthContext";

export default function CustomerLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const { user, companies } = useAuth();

  // A Freelancer with no accepted company has nothing to see in any
  // dashboard page — every one of them would just render empty/broken
  // company-scoped data. Gating here, once, means no individual page
  // needs its own "do I have a company" check.
  const hasNoCompany = user?.account_type === "FREELANCER" && companies.length === 0;

  // Handle Resize
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

  // ESC closes mobile sidebar
  useEffect(() => {
    const listener = (e) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const collapseSidebar = () => {
    setDesktopCollapsed(!desktopCollapsed);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0a0e1c]">

      {/* Mobile Overlay */}

 

      {/* Sidebar */}

      <Sidebar
        open={sidebarOpen}
        collapsed={desktopCollapsed}
        closeSidebar={() => setSidebarOpen(false)}
      />

      {/* Main Area */}

      <div
        className={`
          min-h-screen
          transition-all
          duration-300
          ease-in-out
          ${
            desktopCollapsed
              ? "lg:ml-24"
              : "lg:ml-72"
          }
        `}
      >

        {/* Top Navigation */}

        <Topbar
          screenWidth={screenWidth}
          toggleSidebar={toggleSidebar}
          toggleCollapse={collapseSidebar}
          collapsed={desktopCollapsed}
        />

        {/* Page */}

        <main
          className="
            p-5
            md:p-8
            space-y-8
          "
        >

          {/* Welcome */}

 

          {/* Dynamic Content */}

          {hasNoCompany ? <NoCompanyState /> : (children || <Outlet />)}

        </main>

      </div>

    </div>
  );
}