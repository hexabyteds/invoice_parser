import { Link } from "react-router-dom";

// Registered entity name, address, and UAE Trade Registration/TRN number
// belong here once they're finalized — intentionally left out rather than
// shown as placeholder text, since a visible "[add TRN]" is exactly the
// kind of unfinished-looking placeholder this footer is trying to avoid.
export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 text-sm font-bold text-white">
                EB
              </div>
              <span className="text-lg font-bold text-white">EazeeBooks</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-slate-500">
              AI invoice extraction and bookkeeping automation, built for
              businesses in the UAE.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li><Link to="/features" className="hover:text-white">Features</Link></li>
              <li><Link to="/price" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/register" className="hover:text-white">Start Free</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Company</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li>
                <a href="mailto:sales@eazeebooks.com" className="hover:text-white">
                  Contact
                </a>
              </li>
              <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-8 text-sm text-slate-500">
          © {new Date().getFullYear()} EazeeBooks. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
