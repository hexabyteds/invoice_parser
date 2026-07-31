import { useState, useEffect, useRef } from "react";
import {
    Menu,
    Search,
    Bell,
    Moon,
    Sun,
    ChevronDown,
    Settings,
    LogOut,
    User,
    PanelLeftClose,
    PanelLeftOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../context/AuthContext";

export default function Topbar({
    toggleSidebar,
    toggleCollapse,
    collapsed,
}) {
    const [search, setSearch] = useState("");
    const { isDark, toggleTheme } = useTheme();
    const [profileOpen, setProfileOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    const dropdownRef = useRef(null);
    const notificationsRef = useRef(null);

    const navigate = useNavigate();
    const { logout, user: authUser } = useAuth();

    const user =
        authUser || {
            name: "User",
            email: "user@email.com",
        };

    useEffect(() => {
        function handleClick(e) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setProfileOpen(false);
            }

            if (
                notificationsRef.current &&
                !notificationsRef.current.contains(e.target)
            ) {
                setNotificationsOpen(false);
            }
        }

        window.addEventListener("click", handleClick);

        return () =>
            window.removeEventListener(
                "click",
                handleClick
            );
    }, []);

    return (
        <header
            className="
        sticky
        top-0
        z-30
        h-20
        bg-white/90
        backdrop-blur-xl
        border-b
        border-slate-200
        px-5
        lg:px-8
        flex
        items-center
        justify-between
      "
        >
            {/* ============================
          Left Section
      ============================ */}

            <div className="flex items-center gap-4">

                {/* Mobile Menu */}

                <button
                    onClick={toggleSidebar}
                    className="
            lg:hidden
            w-11
            h-11
            rounded-xl
            border
            border-slate-200
            bg-white
            hover:bg-slate-100
            transition
            flex
            items-center
            justify-center
          "
                >
                    <Menu size={22} />
                </button>

                {/* Desktop Collapse */}

                <button
                    onClick={toggleCollapse}
                    className="
            hidden
            lg:flex
            w-11
            h-11
            rounded-xl
            border
            border-slate-200
            bg-white
            hover:bg-slate-100
            transition
            items-center
            justify-center
            text-slate-900
          "
                >
                    {collapsed ? (
                        <PanelLeftOpen size={18} />
                    ) : (
                        <PanelLeftClose size={18} />
                    )}
                </button>

                {/* Greeting */}

                <div className="hidden md:block">

                    <h2 className="text-2xl font-bold text-slate-800">
                        Welcome back 👋
                    </h2>

                    <p className="text-sm text-slate-500">
                        Here's what's happening today.
                    </p>

                </div>

            </div>

            {/* ============================
          Search Bar
      ============================ */}

            <div
                className="
          hidden
          md:flex
          flex-1
          max-w-xl
          mx-8
        "
            >

                <div className="relative w-full">

                    <Search
                        size={18}
                        className="
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
                    />

                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        className="
              w-full
              rounded-2xl
              border
              border-slate-200
              bg-slate-50
              pl-11
              pr-4
              py-3
              outline-none
              focus:ring-2
              focus:ring-blue-500
              focus:border-blue-500
              transition
            "
                    />

                </div>

            </div>

            {/* ============================
            Right Actions
        ============================ */}

            <div className="flex items-center gap-3">

                {/* Dark Mode */}

                {/* <button
                    onClick={toggleTheme}
                    title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    className="
    w-11
    h-11
    rounded-xl
    border
    border-slate-200
    bg-white
    hover:bg-slate-100
    transition
    flex
    items-center
    justify-center
  "
                >
                    {isDark ? (
                        <Sun size={18} />
                    ) : (
                        <Moon size={18} />
                    )}
                </button> */}

                {/* Notifications */}

                <div className="relative text-slate-900" ref={notificationsRef}>

                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="
    relative
    w-11
    h-11
    rounded-xl
    border
    border-slate-200
    bg-white
    hover:bg-slate-100
    transition
    flex
    items-center
    justify-center
  "
                    >
                        <Bell size={18} />
                    </button>

                    {notificationsOpen && (
                        <div
                            className="
    absolute
    right-0
    mt-3
    w-72
    rounded-2xl
    bg-white
    border
    border-slate-200
    shadow-2xl
    text-black
    overflow-hidden
  "
                        >
                            <div className="px-5 py-4 border-b border-slate-200">
                                <h4 className="font-semibold text-slate-800">
                                    Notifications
                                </h4>
                            </div>

                            <div className="px-5 py-8 text-center text-sm text-slate-500">
                                You're all caught up — no new notifications.
                            </div>
                        </div>
                    )}

                </div>

                {/* ============================
              Profile Dropdown
          ============================ */}

                <div className="relative" ref={dropdownRef}>

                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="
                flex
                items-center
                gap-3
                rounded-2xl
                border
                border-slate-200
                bg-white
                px-3
                py-2
                hover:bg-slate-50
                transition
              "
                    >

                        <div
                            className="
                  w-11
                  h-11
                  rounded-full
                  bg-gradient-to-r
                  from-blue-600
                  to-indigo-600
                  text-white
                  flex
                  items-center
                  justify-center
                  font-bold
                "
                        >
                            {user.name?.charAt(0).toUpperCase()}
                        </div>

                        <div className="hidden md:block text-left">

                            <h4 className="font-semibold text-slate-800">
                                {user.name}
                            </h4>

                            <p className="text-xs text-slate-500">
                                {user.email}
                            </p>

                        </div>

                        <ChevronDown
                            size={18}
                            className={`
                  transition-transform
                  duration-300
                  ${profileOpen ? "rotate-180" : ""}
                `}
                        />

                    </button>

                    {profileOpen && (

                        <div
                            className="
                  absolute
                  right-0
                  mt-3
                  w-64
                  rounded-2xl
                  bg-white
                  border
                  border-slate-200
                  shadow-2xl
                text-black
                  overflow-hidden
                "
                        >

                            <button
                                onClick={() => {
                                    setProfileOpen(false);
                                    navigate("/dashboard/profile");
                                }}
                                className="
                    w-full
                    px-5
                    py-4
                    flex
                    items-center
                    gap-3
                    hover:bg-slate-50
                    transition
                    text-black
                  "
                            >
                                <User size={18} />
                                My Profile
                            </button>

                            <button
                                onClick={() => {
                                    setProfileOpen(false);
                                    navigate("/dashboard/settings");
                                }}
                                className="
                    w-full
                    px-5
                    py-4
                    flex
                    items-center
                    gap-3
                    hover:bg-slate-50
                    text-black
                    transition
                  "
                            >
                                <Settings size={18} />
                                Settings
                            </button>

                            <div className="border-t border-slate-200" />

                            <button
                                onClick={logout}
                                className="
                    w-full
                    px-5
                    py-4
                    flex
                    items-center
                    gap-3
                    text-red-600
                    hover:bg-red-50
                    transition
                  "
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