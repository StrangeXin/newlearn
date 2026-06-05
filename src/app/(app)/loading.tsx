export default function Loading() {
  return (
    <div className="page py-8" aria-busy="true" aria-label="加载中">
      <div className="skeleton h-7 w-40" />
      <div className="skeleton mt-3 h-4 w-64" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton mt-2 h-3 w-1/2" />
              </div>
            </div>
            <div className="skeleton mt-4 h-3 w-full" />
            <div className="skeleton mt-2 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
