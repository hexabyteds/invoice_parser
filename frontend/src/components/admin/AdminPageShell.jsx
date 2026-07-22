export default function AdminPageShell({
  title,
  description,
  children,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {children || (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-slate-700">
            Coming soon
          </p>
          <p className="mt-2 text-sm text-slate-500">
            This admin section will be built in the next phase.
          </p>
        </div>
      )}
    </div>
  );
}
