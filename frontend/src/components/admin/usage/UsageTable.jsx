import UsageRow from "./UsageRow";

export default function UsageTable({ customers = [], onViewCustomer }) {
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
              <th className="px-4 py-4 text-left font-medium">Clients</th>
              <th className="px-4 py-4 text-left font-medium">OCR</th>
              <th className="px-4 py-4 text-left font-medium">Storage</th>
              <th className="px-6 py-4 text-center font-medium">Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <UsageRow
                key={customer.id}
                customer={customer}
                onView={onViewCustomer}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
