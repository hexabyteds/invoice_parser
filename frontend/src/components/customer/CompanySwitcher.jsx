import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// Shown whenever the caller has more than one workspace to choose from —
// today that's only ever a Freelancer (a Company account has exactly one,
// its own). Always shows the active workspace prominently even with a
// single company, so a Freelancer can never lose track of which company
// they're currently acting in (see the architecture's "Company Switcher"
// requirement).
export default function CompanySwitcher() {
  const { companies, currentCompany, switchCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  const single = companies.length === 1;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !single && setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition ${
          single ? "cursor-default" : "hover:bg-slate-50"
        }`}
      >
        <Building2 size={16} className="text-indigo-600" />
        <span className="max-w-[10rem] truncate">
          {currentCompany?.companyName || "Select company"}
        </span>
        {!single && (
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && !single && (
        <div
          role="listbox"
          className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
        </div>
      )}
    </div>
  );
}
