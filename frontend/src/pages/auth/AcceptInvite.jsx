import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2, Check, X, Loader2 } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import RegisterForm from "../../components/auth/RegisterForm";
import companyApi from "../../services/companyApi";
import { useAuth } from "../../context/AuthContext";

function InvitationCard({ invitation }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
          <Building2 size={20} />
        </div>
        <div>
          <p className="font-semibold text-white">{invitation.companyName}</p>
          <p className="text-sm text-slate-400">Invited as Freelancer</p>
        </div>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Invited by</dt>
          <dd className="text-slate-300">{invitation.inviterName || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Invited email</dt>
          <dd className="text-slate-300">{invitation.invitedEmail}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Expires</dt>
          <dd className="text-slate-300">
            {new Date(invitation.expiresAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// The single entry point for the emailed invite link (`/invite/:token`).
// Which branch renders is decided fresh on every load — an account could
// have been created between the invite being sent and the link being
// opened — never cached from invite-send time. See services/companyService
// .validateInvitationToken and the Case A/B/C flows in the product spec.
export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    companyApi
      .getInvitationByToken(token)
      .then((res) => {
        if (!cancelled) setInvitation(res.data);
      })
      .catch(() => {
        if (!cancelled) setInvitation({ valid: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      await companyApi.acceptInvitationByToken(token);
      await refreshUser();
      toast.success(`You're now connected to ${invitation.companyName}.`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't accept invitation.");
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await companyApi.declineInvitation(invitation.id);
      toast.success("Invitation declined.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't decline invitation.");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout variant="minimal" title="Invitation" subtitle="Checking your invitation…">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          Loading…
        </div>
      </AuthLayout>
    );
  }

  if (!invitation?.valid) {
    return (
      <AuthLayout variant="minimal" title="Invitation" subtitle="">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <p className="text-lg font-semibold text-white">
            This invitation is no longer valid.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            It may have expired, already been used, or been revoked. Ask the
            company to send you a new invitation.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            Go to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // Case A — no account for the invited email yet: complete Freelancer
  // signup, locked to the invited email, which auto-accepts as part of
  // the same request (see services/authService.js's register()).
  if (!user && !invitation.accountExists) {
    return (
      <AuthLayout
        title="Join as a Freelancer"
        subtitle={`Create your account to start managing ${invitation.companyName}.`}
      >
        <RegisterForm
          invitationToken={token}
          invitedEmail={invitation.invitedEmail}
          companyName={invitation.companyName}
        />
      </AuthLayout>
    );
  }

  // Case B — an account already exists for the invited email, but this
  // visitor isn't logged in yet: log in first, then land back on this
  // same page (Login.jsx's `?next=` param), which will then render Case C.
  if (!user) {
    return (
      <AuthLayout
        variant="minimal"
        title="You've been invited"
        subtitle={`${invitation.companyName} wants you to manage their books.`}
      >
        <InvitationCard invitation={invitation} />
        <Link
          to={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-6 block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-center font-semibold text-white transition hover:opacity-90"
        >
          Log in to accept
        </Link>
        <p className="mt-4 text-center text-sm text-slate-500">
          Not {invitation.invitedEmail}?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
            Use a different account
          </Link>
        </p>
      </AuthLayout>
    );
  }

  // Case C — logged in. The authenticated session is the proof of email
  // ownership here (no raw token needed), but a mismatched email must
  // never silently attach the company to the wrong account.
  const emailMatches = user.email?.trim().toLowerCase() === invitation.invitedEmail;

  return (
    <AuthLayout
      variant="minimal"
      title="You've been invited"
      subtitle={`${invitation.companyName} wants you to manage their books.`}
    >
      <InvitationCard invitation={invitation} />

      {!emailMatches ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This invitation was sent to another email address. Please log in
          with the invited email address to accept this invitation.
        </div>
      ) : (
        <div className="mt-6 flex gap-3">
          <button
            onClick={accept}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            <Check size={16} />
            Accept Invitation
          </button>
          <button
            onClick={decline}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <X size={16} />
            Decline
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
