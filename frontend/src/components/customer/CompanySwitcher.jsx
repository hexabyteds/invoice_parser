import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import toast from "react-hot-toast";
import companyApi from "../../services/companyApi";
import { useAuth } from "../../context/AuthContext";

// Shown whenever the caller has more than one workspace to choose from —
// today that's only ever a Freelancer (a Company account has exactly one,
// its own). Always shows the active workspace prominently even with a
// single company, so a Freelancer can never lose track of which company
// they're currently acting in (see the architecture's "Company Switcher"
// requirement).
export default function CompanySwitcher() {
  const { user, companies, currentCompany, refreshUser, switchCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  const isFreelancer = user?.account_type === "FREELANCER";

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  if (!companies.length) return null;

  // A Company account always has exactly its own one workspace and no
  // ability to create/join others, so its switcher stays a static label.
  // A Freelancer can always open this — even with just one company today —
  // since "+ Create Company" needs to be reachable regardless of count.
  const interactive = isFreelancer;

  async function createCompany(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const res = await companyApi.createCompany({ name: name.trim() });
      toast.success(`${name.trim()} created.`);
      await refreshUser();
      setOpen(false);
      setName("");
      switchCompany(res.data.companyId);
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't create company.");
      setCreating(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => interactive && setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition ${
          interactive ? "hover:bg-slate-50" : "cursor-default"
        }`}
      >
        <Building2 size={16} className="text-indigo-600" />
        <span className="max-w-[10rem] truncate">
          {currentCompany?.companyName || "Select company"}
        </span>
        {interactive && (
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && interactive && (
        <div
          role="listbox"
          className="absolute left-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            My Companies
          </div>

          {companies.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={c.companyId === currentCompany?.companyId}
              onClick={() => {
                setOpen(false);
                if (c.companyId !== currentCompany?.companyId) {
                  switchCompany(c.companyId);
                }
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-800 transition hover:bg-slate-50"
            >
              <span className="flex flex-col">
                <span className="font-medium">{c.companyName}</span>
                <span className="text-xs text-slate-400">
                  {c.role === "OWNER" ? "Owner" : "Freelancer"}
                </span>
              </span>
              {c.companyId === currentCompany?.companyId && (
                <Check size={16} className="text-indigo-600" />
              )}
            </button>
          ))}

          <form onSubmit={createCompany} className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="New company name"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus size={14} />
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
