import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  ScrollText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  UserCircle2,
  BadgeCheck,
  Repeat,
  Gauge,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "Customers", icon: Users, path: "/admin/customers" },
  { title: "Companies", icon: Building2, path: "/admin/companies" },
  { title: "Plans", icon: BadgeCheck, path: "/admin/plans" },
  { title: "Subscriptions", icon: Repeat, path: "/admin/subscriptions" },
  { title: "Usage", icon: Gauge, path: "/admin/usage" },
  { title: "Payments", icon: CreditCard, path: "/admin/payments" },
  { title: "Audit Logs", icon: ScrollText, path: "/admin/audit-logs" },
  { title: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  { title: "Settings", icon: Settings, path: "/admin/settings" },
];

export default function AdminSidebar({
  open,
  collapsed,
  closeSidebar,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const sidebarWidth = collapsed ? "w-24" : "w-72";

  const navItem =
    "flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-200";

  const activeNav =
    "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/50";

  const inactiveNav =
    "text-slate-400 hover:bg-white/5 hover:text-white";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {open && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 flex h-screen flex-col
          border-r border-white/5 bg-gradient-to-b from-[#0a0e1c] to-[#020510]
          transition-all duration-300
          ${sidebarWidth}
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/5 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-xl font-bold text-white shadow-lg shadow-indigo-950/50">
              EB
            </div>

            {!collapsed && (
              <div>
                <h2 className="text-xl font-bold text-white font-display tracking-tight">
                  EazeeBooks
                </h2>
                <p className="text-xs text-slate-400">
                  Admin Portal
                </p>
              </div>
            )}
          </div>

          <button
            onClick={closeSidebar}
            aria-label="Close sidebar"
            className="text-slate-400 transition-colors hover:text-white lg:hidden"
          >
            <Menu size={22} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `${navItem} ${isActive ? activeNav : inactiveNav}`
                }
              >
                <Icon size={22} className="flex-shrink-0" />

                {!collapsed && (
                  <span className="font-medium">
                    {item.title}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-4 border-t border-white/5 p-5">
          <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <UserCircle2 size={28} />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <h4 className="truncate font-semibold text-white">
                    {user?.name || "Admin"}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {user?.role || "Owner"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-4 rounded-xl bg-red-500/10 px-4 py-3 text-red-400 transition-all duration-300 hover:bg-red-500 hover:text-white"
          >
            <LogOut size={20} />
            {!collapsed && (
              <span className="font-medium">Logout</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
