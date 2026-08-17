import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import UsageRow from "./UsageRow";

const ROWS_PER_PAGE = 20;

export default function UsageTable({ customers = [], onViewCustomer }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [customers]);

  const total = customers.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * ROWS_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ROWS_PER_PAGE, total);

  const paginatedCustomers = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return customers.slice(start, start + ROWS_PER_PAGE);
  }, [customers, safePage]);

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-500">
        No customer usage data found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-4 text-left font-medium">Customer</th>
              <th className="px-4 py-4 text-left font-medium">Plan</th>
              <th className="px-4 py-4 text-left font-medium">Invoices</th>
              <th className="px-4 py-4 text-left font-medium">Bank Statements</th>
              <th className="px-4 py-4 text-left font-medium">Clients</th>
              <th className="px-4 py-4 text-left font-medium">OCR</th>
              <th className="px-4 py-4 text-left font-medium">Storage</th>
              <th className="px-6 py-4 text-center font-medium">Action</th>
            </tr>
          </thead>

          <tbody>
            {paginatedCustomers.map((customer) => (
              <UsageRow
                key={customer.id}
                customer={customer}
                onView={onViewCustomer}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row">
        <p className="text-sm text-slate-600">
          Showing {rangeStart}–{rangeEnd} of {total} customers
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <span className="px-2 text-sm text-slate-600">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
