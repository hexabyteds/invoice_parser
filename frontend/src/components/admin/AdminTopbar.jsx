import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminTopbar({
  toggleSidebar,
  toggleCollapse,
  collapsed,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("click", handleClick);

    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-xl lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <button
          onClick={toggleCollapse}
          className="hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-100 lg:flex"
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>

        <div className="hidden md:block">
          <h2 className="text-2xl font-bold text-slate-800">
            Admin Console
          </h2>
          <p className="text-sm text-slate-500">
            Platform overview and management.
          </p>
        </div>
      </div>

      <div className="mx-8 hidden max-w-xl flex-1 md:flex">
        <div className="relative w-full">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search customers, companies..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-100">
          <Bell size={18} />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-purple-600 font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>

            <div className="hidden text-left md:block">
              <h4 className="font-semibold text-slate-800">
                {user?.name || "Admin"}
              </h4>
              <p className="text-xs text-slate-500">
                {user?.email || "admin@eazeebooks.com"}
              </p>
            </div>

            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ${profileOpen ? "rotate-180" : ""}`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-black shadow-2xl">
              <button className="flex w-full items-center gap-3 px-5 py-4 transition hover:bg-slate-50">
                <User size={18} />
                My Profile
              </button>

              <button className="flex w-full items-center gap-3 px-5 py-4 transition hover:bg-slate-50">
                <Settings size={18} />
                Settings
              </button>

              <div className="border-t border-slate-200" />

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-5 py-4 text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
