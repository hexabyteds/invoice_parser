import { NavLink } from "react-router-dom";
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
  CreditCard,
  Truck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "Customers",
    icon: FolderOpen,
    path: "/dashboard/customers",
  },
  {
    title: "Suppliers",
    icon: Truck,
    path: "/dashboard/suppliers",
  },
  {
    title: "Quick Upload Documents",
    icon: Upload,
    path: "/dashboard/upload",
  },
  {
    title: "Documents",
    icon: FileText,
    path: "/dashboard/invoices",
  },
  {
    title: "Reports & Analytics",
    icon: BarChart3,
    path: "/dashboard/analytics",
  },
  {
    title: "Export Center",
    icon: FileSpreadsheet,
    path: "/dashboard/export",
  },
  {
    title: "Usage",
    icon: Gauge,
    path: "/dashboard/usage",
  },
  {
    title: "Billing & Payments",
    icon: CreditCard,
    path: "/dashboard/billing",
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
  const { user, logout } = useAuth();

  const sidebarWidth = collapsed ? "w-24" : "w-72";

  const navItem =
    "flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-200";

  const activeNav =
    "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/50";

  const inactiveNav =
    "text-slate-400 hover:bg-white/5 hover:text-white";

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
              bg-gradient-to-b
              from-[#0a0e1c]
              to-[#020510]
              border-r
              border-white/5
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
                border-white/5
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
                    bg-gradient-to-br
                    from-indigo-500
                    via-violet-500
                    to-purple-600
                    flex
                    items-center
                    justify-center
                    text-white
                    font-bold
                    text-xl
                    shadow-lg
                    shadow-indigo-950/50
                  "
                >
                  EB
                </div>

                {!collapsed && (
                  <div>

                    <h2
                      className="
                        text-white
                        text-xl
                        font-bold
                        font-display
                        tracking-tight
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
                aria-label="Close sidebar"
                className="
                  lg:hidden
                  text-slate-400
                  hover:text-white
                  transition-colors
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
            border-white/5
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
                bg-white/5
                hover:bg-white/10
                border
                border-white/5
                px-4
                py-3
                transition
              "
            >

              <div className="flex items-center gap-3">

                <Bell
                  size={20}
                  className="text-indigo-400"
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
                  bg-gradient-to-r
                  from-indigo-500
                  to-violet-500
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
              bg-white/5
              border
              border-white/5
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
                  bg-gradient-to-br
                  from-indigo-500
                  to-violet-600
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
                      truncate
                    "
                  >
                    {user?.name || "User"}
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
              bg-rose-500/10
              hover:bg-rose-500
              text-rose-400
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