import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  UserCircle2,
  Bell,
  FolderOpen,
  FileSpreadsheet,
  Gauge,
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "Clients",
    icon: FolderOpen,
    path: "/dashboard/clients",
  },
  {
    title: "Quick Upload Invoice",
    icon: Upload,
    path: "/dashboard/upload",
  },
  {
    title: "Invoices",
    icon: FileText,
    path: "/dashboard/invoices",
  },
  {
    title: "Reports",
    icon: FolderOpen,
    path: "/dashboard/reports",
  },
  {
    title: "Analytics",
    icon: BarChart3,
    path: "/dashboard/analytics",
  },
  {
    title: "Excel Export",
    icon: FileSpreadsheet,
    path: "/dashboard/export",
  },
  {
    title: "Usage",
    icon: Gauge,
    path: "/dashboard/usage",
  },
  {
    title: "Settings",
    icon: Settings,
    path: "/dashboard/settings",
  },
];

export default function Sidebar({
  open,
  collapsed,
  closeSidebar,
}) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const sidebarWidth = collapsed ? "w-24" : "w-72";

  const navItem =
    "flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-200";

  const activeNav =
    "bg-blue-600 text-white shadow-lg";

  const inactiveNav =
    "text-slate-300 hover:bg-slate-800 hover:text-white";

    return (
        <>
          {/* ================================
              Mobile Overlay
          ================================= */}
    
          {open && (
            <div
              onClick={closeSidebar}
              className="
                fixed
                inset-0
                bg-black/60
                backdrop-blur-sm
                z-40
                lg:hidden
              "
            />
          )}
    
          {/* ================================
              Sidebar
          ================================= */}
    
          <aside
            className={`
              fixed
              top-0
              left-0
              h-screen
              ${sidebarWidth}
              bg-slate-950
              border-r
              border-slate-800
              flex
              flex-col
              transition-all
              duration-300
              z-50
    
              ${
                open
                  ? "translate-x-0"
                  : "-translate-x-full lg:translate-x-0"
              }
            `}
          >
    
            {/* ==========================
                Logo
            =========================== */}
    
            <div
              className="
                h-20
                flex
                items-center
                justify-between
                px-6
                border-b
                border-slate-800
              "
            >
    
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
    
                <div
                  className="
                    w-12
                    h-12
                    rounded-2xl
                    bg-gradient-to-r
                    from-blue-600
                    to-indigo-600
                    flex
                    items-center
                    justify-center
                    text-white
                    font-bold
                    text-xl
                    shadow-lg
                  "
                >
                  IP
                </div>
    
                {!collapsed && (
                  <div>
    
                    <h2
                      className="
                        text-white
                        text-xl
                        font-bold
                      "
                    >
                      EazeeBooks
                    </h2>
    
                    <p
                      className="
                        text-xs
                        text-slate-400
                      "
                    >
                      Invoice Automation
                    </p>
    
                  </div>
                )}
    
              </div>
    
              {/* Mobile Close */}
    
              <button
                onClick={closeSidebar}
                className="
                  lg:hidden
                  text-slate-400
                  hover:text-white
                "
              >
                <Menu size={22} />
              </button>
    
            </div>
    
            {/* ==========================
                Navigation
            =========================== */}
    
            <nav
              className="
                flex-1
                overflow-y-auto
                px-4
                py-6
                space-y-2
              "
            >
    
              {menuItems.map((item) => {
    
                const Icon = item.icon;
    
                return (
    
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/dashboard"}
                    className={({ isActive }) =>
                      `${navItem} ${
                        isActive
                          ? activeNav
                          : inactiveNav
                      }`
                    }
                  >
    
                    <Icon
                      size={22}
                      className="
                        flex-shrink-0
                      "
                    />
    
                    {!collapsed && (
    
                      <span
                        className="
                          font-medium
                        "
                      >
                        {item.title}
                      </span>
    
                    )}
    
                  </NavLink>
    
                );
    
              })}
    
            </nav>
                    {/* ==========================
            Footer
        =========================== */}

        <div
          className="
            border-t
            border-slate-800
            p-5
            space-y-4
          "
        >

          {/* Notifications */}

          {!collapsed && (

            <button
              className="
                w-full
                flex
                items-center
                justify-between
                rounded-xl
                bg-slate-900
                hover:bg-slate-800
                px-4
                py-3
                transition
              "
            >

              <div className="flex items-center gap-3">

                <Bell
                  size={20}
                  className="text-blue-400"
                />

                <span className="text-slate-300">
                  Notifications
                </span>

              </div>

              <span
                className="
                  w-6
                  h-6
                  rounded-full
                  bg-blue-600
                  text-white
                  text-xs
                  flex
                  items-center
                  justify-center
                "
              >
                3
              </span>

            </button>

          )}

          {/* User Card */}

          <div
            className="
              rounded-2xl
              bg-slate-900
              p-4
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <div
                className="
                  w-12
                  h-12
                  rounded-full
                  bg-gradient-to-r
                  from-blue-500
                  to-indigo-600
                  flex
                  items-center
                  justify-center
                  text-white
                "
              >
                <UserCircle2 size={28} />
              </div>

              {!collapsed && (

                <div className="flex-1">

                  <h4
                    className="
                      text-white
                      font-semibold
                    "
                  >
                    Toqeer Arif
                  </h4>

                  <p
                    className="
                      text-sm
                      text-slate-400
                    "
                  >
                    Administrator
                  </p>

                </div>

              )}

            </div>

          </div>

          {/* Logout */}

          <button
            onClick={logout}
            className="
              w-full
              flex
              items-center
              gap-4
              rounded-xl
              bg-red-500/10
              hover:bg-red-500
              text-red-400
              hover:text-white
              px-4
              py-3
              transition-all
              duration-300
            "
          >

            <LogOut size={20} />

            {!collapsed && (
              <span className="font-medium">
                Logout
              </span>
            )}

          </button>

        </div>
        </aside>
    </>
  );
}