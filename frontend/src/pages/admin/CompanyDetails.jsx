import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Hash,
  Calendar,
  Users,
  Truck,
  FileText,
  Landmark,
  CreditCard,
  Clock,
  ShieldAlert,
  ShieldCheck,
  PauseCircle,
  XCircle,
} from "lucide-react";
import AdminPageShell from "../../components/admin/AdminPageShell";
import adminApi from "../../services/adminApi";

const STATUS_STYLES = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  SUSPENDED: "bg-amber-100 text-amber-700",
  DEACTIVATED: "bg-red-100 text-red-600",
};

const HEALTH_STYLES = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "Near Usage Limit": "bg-amber-100 text-amber-700",
  "Limit Reached": "bg-red-100 text-red-600",
  "Payment Issue": "bg-red-100 text-red-600",
  Suspended: "bg-slate-200 text-slate-700",
};

const TABS = ["Overview", "Users & Access", "Business Data", "Usage", "Billing", "Activity"];

function Badge({ className, children }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value || "—"}</p>
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
      {title && <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>}
      {children}
    </div>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function UsageMeter({ label, used, limit }) {
  const unlimited = limit === null || limit === undefined;
  const ratio = unlimited ? 0 : limit > 0 ? Math.min(used / limit, 1) : used > 0 ? 1 : 0;
  const barColor = ratio >= 1 ? "bg-red-500" : ratio >= 0.7 ? "bg-amber-500" : "bg-indigo-500";

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="text-sm text-slate-500">
          {used} / {unlimited ? "Unlimited" : limit}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${unlimited ? "bg-indigo-300" : barColor}`}
          style={{ width: `${unlimited ? 100 : ratio * 100}%` }}
        />
      </div>
      {!unlimited && ratio >= 0.7 && (
        <p className={`mt-1.5 text-xs font-medium ${ratio >= 1 ? "text-red-600" : "text-amber-600"}`}>
          {ratio >= 1 ? "Limit reached" : "Near limit"}
        </p>
      )}
    </div>
  );
}

export default function CompanyDetails() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getCompany(id);
      setData(res);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load company.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi
      .getCompanyActivity(id)
      .then((res) => setActivity(res.activity || []))
      .catch(() => setActivity([]));
  }, [id]);

  const changeStatus = async (status) => {
    try {
      setBusy(true);
      await adminApi.updateCompanyStatus(id, status);
      toast.success(`Company ${status.toLowerCase()}.`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to update status.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AdminPageShell title="Company Details" description="Loading..." />;
  }

  if (!data) {
    return (
      <AdminPageShell title="Company Details" description="Company not found.">
        <Link to="/admin/companies" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← Back to companies
        </Link>
      </AdminPageShell>
    );
  }

  const { company, account, freelancerOtherCompanies, team, businessData, usage, billing } = data;

  return (
    <div className="space-y-6">
      <Link to="/admin/companies" className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← Back to companies
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
              <Badge className={STATUS_STYLES[company.status]}>{company.status}</Badge>
              <Badge className={HEALTH_STYLES[company.health] || "bg-slate-100 text-slate-600"}>
                {company.health}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {company.code} · {account.plan} Plan
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {company.status !== "ACTIVE" && (
              <button
                onClick={() => changeStatus("ACTIVE")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                Activate
              </button>
            )}
            {company.status !== "SUSPENDED" && (
              <button
                onClick={() => changeStatus("SUSPENDED")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
              >
                <PauseCircle size={16} />
                Suspend
              </button>
            )}
            {company.status !== "DEACTIVATED" && (
              <button
                onClick={() => changeStatus("DEACTIVATED")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle size={16} />
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === t
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Company Information">
            <InfoRow icon={Building2} label="Legal Name" value={company.legalName || company.name} />
            <InfoRow icon={Hash} label="Company ID" value={company.code} />
            <InfoRow icon={Mail} label="Email" value={company.email} />
            <InfoRow icon={Phone} label="Phone" value={company.phone} />
            <InfoRow icon={MapPin} label="Address" value={company.address} />
            <InfoRow icon={Hash} label="TRN / VAT Number" value={company.trn} />
            <InfoRow icon={Calendar} label="Created Date" value={formatDate(company.createdAt)} />
          </Card>

          <Card title="Account Information">
            <InfoRow icon={Building2} label="Account Type" value={account.type} />
            <InfoRow icon={FileText} label="Current Plan" value={account.plan} />
            <InfoRow icon={ShieldCheck} label="Subscription Status" value={account.subscriptionStatus} />
            <InfoRow
              icon={Users}
              label={account.createdBy === "FREELANCER" ? "Created By (Freelancer)" : "Owner"}
              value={`${account.owner.name} (${account.owner.email})`}
            />
            <InfoRow icon={Clock} label="Last Login" value={formatDateTime(account.lastLogin)} />
          </Card>

          {account.managingFreelancer && (
            <Card title="Freelancer Relationship" className="lg:col-span-2">
              <p className="text-sm text-slate-600">
                Created and managed by{" "}
                <span className="font-semibold text-slate-900">{account.managingFreelancer.name}</span> (
                {account.managingFreelancer.email}).
              </p>

              {freelancerOtherCompanies.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Other Companies Managed by {account.managingFreelancer.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {freelancerOtherCompanies.map((c) => (
                      <Link
                        key={c.id}
                        to={`/admin/companies/${c.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <Building2 size={13} />
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">No other companies managed by this Freelancer.</p>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === "Users & Access" && (
        <Card title={`Authorized Freelancers (${team.length})`}>
          {team.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No freelancers have been granted access to this company.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Access Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((m) => (
                    <tr key={m.membershipId} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-800">{m.name}</td>
                      <td className="py-3 pr-4 text-slate-600">{m.email}</td>
                      <td className="py-3 pr-4 capitalize text-slate-600">{m.role?.toLowerCase()}</td>
                      <td className="py-3 pr-4">
                        <Badge
                          className={
                            m.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : m.status === "SUSPENDED"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-600"
                          }
                        >
                          {m.status?.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{formatDate(m.acceptedAt || m.invitedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Business Data" && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Customers</p>
                <p className="text-2xl font-bold text-slate-900">{businessData.customers}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Suppliers</p>
                <p className="text-2xl font-bold text-slate-900">{businessData.suppliers}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Invoices</p>
                <p className="text-2xl font-bold text-slate-900">{businessData.invoices}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Bills</p>
                <p className="text-2xl font-bold text-slate-900">{businessData.bills}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Landmark size={20} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Bank Statements</p>
                <p className="text-2xl font-bold text-slate-900">{businessData.bankStatements}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "Usage" && (
        <div className="space-y-6">
          <Card title={`Current Plan: ${usage.plan.name}`}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <UsageMeter label="Customers" used={usage.usage.customers.used} limit={usage.usage.customers.limit} />
              <UsageMeter label="Suppliers" used={usage.usage.suppliers.used} limit={usage.usage.suppliers.limit} />
              <UsageMeter label="Invoices" used={usage.usage.invoices.used} limit={usage.usage.invoices.limit} />
              <UsageMeter label="OCR Pages" used={usage.usage.ocr.used} limit={usage.usage.ocr.limit} />
              <UsageMeter label="Team Members" used={usage.usage.team.used} limit={usage.usage.team.limit} />
            </div>
          </Card>

          {usage.companies && (
            <Card title="Freelancer Company Usage (account-wide)">
              <p className="mb-3 text-xs text-slate-400">
                This Freelancer's company-count cap — shared across every company they manage, unrelated to this
                company's own Customer/Supplier/Invoice usage above.
              </p>
              <UsageMeter label="Companies" used={usage.companies.used} limit={usage.companies.limit} />
            </Card>
          )}
        </div>
      )}

      {tab === "Billing" && (
        <Card title="Billing">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <InfoRow icon={CreditCard} label="Current Plan" value={billing.plan} />
            <InfoRow icon={Clock} label="Billing Cycle" value={billing.billingCycle} />
            <InfoRow icon={ShieldCheck} label="Subscription Status" value={billing.status} />
            <InfoRow icon={Calendar} label="Subscription Start" value={formatDate(billing.startsAt)} />
            <InfoRow icon={Calendar} label="Next Billing Date" value={formatDate(billing.nextBilling)} />
            <InfoRow
              icon={CreditCard}
              label="Amount"
              value={billing.price === null ? "—" : `AED ${Number(billing.price).toFixed(2)}`}
            />
            <InfoRow
              icon={ShieldAlert}
              label="Cancellation Status"
              value={
                billing.cancelledAt
                  ? `Cancelled ${formatDate(billing.cancelledAt)}`
                  : billing.cancelAtPeriodEnd
                    ? "Cancels at period end"
                    : "Not cancelled"
              }
            />
            <InfoRow icon={CreditCard} label="Stripe Status" value={billing.stripeStatus || "—"} />
          </div>
        </Card>
      )}

      {tab === "Activity" && (
        <Card title="Recent Activity">
          <p className="mb-4 text-xs text-slate-400">
            Currently tracks document uploads (invoices, bills, bank statements) — customer/supplier edits and plan
            changes are not yet logged to the audit trail.
          </p>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No recorded activity for this company yet.</p>
          ) : (
            <div className="space-y-4">
              {activity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 border-b border-slate-100 pb-4 last:border-0">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  <div>
                    <p className="text-sm text-slate-800">
                      {event.description || event.action}
                      {event.actor_name && <span className="text-slate-400"> — {event.actor_name}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(event.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
