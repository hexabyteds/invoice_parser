import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import subscriptionApi from "../../services/subscriptionApi";

const REDIRECT_DELAY_MS = 2000;

// Stripe Checkout's success_url lands here. We deliberately do NOT trust
// the redirect itself as proof of payment — the webhook is what actually
// activates the plan, so this page just re-fetches the real subscription
// state from our own API and shows whatever it finds.
export default function BillingReturn() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    // The webhook that activates the plan can arrive a beat after Stripe
    // redirects the browser back here, so poll briefly instead of
    // reporting "not active yet" on the very first check.
    async function poll() {
      attempts += 1;

      try {
        const response = await subscriptionApi.getCurrent();

        if (cancelled) return;

        const current = response.data.subscription;

        if (current?.stripe_status === "active" || attempts >= 5) {
          setSubscription(current);
          setLoading(false);
          return;
        }

        setTimeout(poll, 2000);
      } catch (err) {
        if (cancelled) return;

        setError(
          err.response?.data?.error || "Couldn't load your subscription."
        );
        setLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, []);

  // Confirmed active — hand off to the main dashboard automatically instead
  // of making the user click through.
  useEffect(() => {
    if (loading || error || subscription?.stripe_status !== "active") return;

    const timer = setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loading, error, subscription, navigate]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center shadow-sm">
      {loading && (
        <>
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <h1 className="mt-6 text-2xl font-bold text-slate-800">
            Confirming your subscription...
          </h1>
          <p className="mt-2 text-slate-500">
            This only takes a moment while we sync with Stripe.
          </p>
        </>
      )}

      {!loading && error && (
        <>
          <AlertTriangle className="text-amber-500" size={40} />
          <h1 className="mt-6 text-2xl font-bold text-slate-800">
            Couldn't confirm your subscription
          </h1>
          <p className="mt-2 text-slate-500">{error}</p>
        </>
      )}

      {!loading && !error && subscription?.stripe_status === "active" && (
        <>
          <CheckCircle2 className="text-emerald-500" size={40} />
          <h1 className="mt-6 text-2xl font-bold text-slate-800">
            You're on {subscription.name}
          </h1>
          <p className="mt-2 text-slate-500">
            Your subscription is active. Your new plan limits apply
            immediately.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Taking you to your dashboard...
          </p>
        </>
      )}

      {!loading && !error && subscription?.stripe_status !== "active" && (
        <>
          <Loader2 className="text-slate-400" size={40} />
          <h1 className="mt-6 text-2xl font-bold text-slate-800">
            Still processing
          </h1>
          <p className="mt-2 text-slate-500">
            Stripe is still confirming your payment. Check back on the Usage
            page in a minute — it'll update automatically once confirmed.
          </p>
        </>
      )}

      <Link
        to="/dashboard/usage"
        className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Go to Usage &amp; Billing
      </Link>
    </div>
  );
}
