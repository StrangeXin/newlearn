export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <span className="text-sm">加载中…</span>
      </div>
    </div>
  );
}
