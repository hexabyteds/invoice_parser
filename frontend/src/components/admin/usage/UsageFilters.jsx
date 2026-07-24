import { Search } from "lucide-react";

export default function UsageFilters({
  search,
  onSearchChange,
  planFilter,
  onPlanFilterChange,
  plans = [],
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative max-w-md flex-1">
        <Search
          size={18}
          className="absolute left-4 top-3.5 text-slate-400"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search customer, email, company..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <select
        value={planFilter}
        onChange={(e) => onPlanFilterChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
      >
        <option value="all">All plans</option>
        {plans.map((plan) => (
          <option key={plan} value={plan}>
            {plan}
          </option>
        ))}
      </select>
    </div>
  );
}
