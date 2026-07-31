function Block({ className = "" }) {
  return <div className={`rounded-2xl bg-slate-100 animate-pulse ${className}`} />;
}

export default function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Block className="h-44 rounded-3xl" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-32" />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Block className="h-64" />
            <Block className="h-64" />
          </div>
          <Block className="h-80" />
          <Block className="h-80" />
          <Block className="h-96" />
        </div>
        <div className="space-y-6">
          <Block className="h-72" />
          <Block className="h-72" />
        </div>
      </div>
    </div>
  );
}
