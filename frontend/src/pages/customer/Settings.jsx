import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display tracking-tight">Settings</h1>
          <p className="text-slate-500 mt-2">
            Manage your account and workspace preferences.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <SettingsIcon size={26} />
          </div>
          <p className="mt-5 text-lg font-semibold text-slate-700">
            Coming soon
          </p>
          <p className="mt-2 text-sm text-slate-500">
            More workspace settings will be available here soon.
          </p>
        </div>
      </div>
    );
  }