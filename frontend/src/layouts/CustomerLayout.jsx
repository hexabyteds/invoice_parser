import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Mail, X, Clock } from "lucide-react";
import Sidebar from "../components/customer/Sidebar";
import Topbar from "../components/customer/Topbar";
import NoCompanyState from "../components/customer/NoCompanyState";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function CustomerLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const { user, companies } = useAuth();
  const navigate = useNavigate();

  // Soft, not blocking — verification is real (see authService.verifyEmail)
  // but nothing here gates dashboard access on it, so this is just a
  // dismissible nudge, not a wall.
  const showVerifyBanner = user && !user.email_verified && !verifyBannerDismissed;

  // trial info comes from GET /auth/me (see authService.me) — server-
  // computed, never a client-side countdown. Only the still-counting-down
  // state is dismissible; once expired it's a real functional constraint
  // (backend blocks writes — see middleware/requireActiveSubscription.js),
  // not a nudge, so it stays visible.
  const trial = user?.subscription?.trial;
  const showTrialCountdown = trial?.isTrialing && !trial.isExpired && !trialBannerDismissed;
  const showTrialExpired = trial?.isTrialing && trial.isExpired;

  async function resendVerification() {
    try {
      await api.post("/auth/resend-verification");
      toast.success("Verification email sent.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't send verification email.");
    }
  }

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

          {/* Verify email nudge — dismissible, never blocks access */}

          {showVerifyBanner && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Mail size={16} />
                <span>Verify your email address to secure your account.</span>
                <button
                  onClick={resendVerification}
                  className="font-medium underline underline-offset-2 hover:no-underline"
                >
                  Resend email
                </button>
              </div>
              <button
                onClick={() => setVerifyBannerDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Trial countdown — dismissible while still counting down */}

          {showTrialCountdown && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>
                  {trial.daysRemaining <= 1
                    ? "Trial ends today."
                    : `${trial.daysRemaining} days remaining in your free trial.`}
                </span>
                <button
                  onClick={() => navigate("/dashboard/billing")}
                  className="font-medium underline underline-offset-2 hover:no-underline"
                >
                  Upgrade Plan
                </button>
              </div>
              <button
                onClick={() => setTrialBannerDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Trial expired — a real functional constraint, not a nudge,
              so no dismiss button */}

          {showTrialExpired && (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Your 7-day free trial has ended.</p>
                <p>
                  Your account and data are still available, but transactional
                  features are currently disabled. Upgrade your plan to
                  continue using all features.
                </p>
              </div>
              <button
                onClick={() => navigate("/dashboard/billing")}
                className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 font-medium text-white transition hover:bg-amber-700"
              >
                Upgrade Plan
              </button>
            </div>
          )}

          {/* Dynamic Content */}

          {hasNoCompany ? <NoCompanyState /> : (children || <Outlet />)}

        </main>

      </div>

    </div>
  );
}