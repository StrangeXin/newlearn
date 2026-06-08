import Image from "next/image";

export function KeywordIllustrationImage({
  term,
  src,
  compact = false,
}: {
  term: string;
  src?: string | null;
  compact?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className={`relative bg-white ${compact ? "aspect-[3/2]" : "aspect-video"}`}>
        {src ? (
          <Image
            src={src}
            alt={`${term} 的手绘配图`}
            fill
            sizes={compact ? "(max-width: 1024px) 100vw, 420px" : "(max-width: 896px) 100vw, 848px"}
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div>
              <div className="text-sm font-bold text-ink">待生成手绘配图</div>
              <p className="mt-1 text-xs text-muted">
                这张图会根据关键词、简介和考核要点生成。
              </p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}

export function KeywordIllustrationAdminPanel({
  term,
  prompt,
  src,
}: {
  term: string;
  prompt?: string | null;
  src?: string | null;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-brand-700">关键词手绘配图</div>
          <p className="mt-0.5 text-xs text-muted">根据关键词、简介和考核要点生成。</p>
        </div>
        {src ? (
          <span className="badge badge-success">已有图片</span>
        ) : (
          <span className="badge badge-muted">待生成</span>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <KeywordIllustrationImage term={term} src={src} compact />
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-muted">生成提示词</div>
            <span className="text-xs text-muted">离线生成后放入 public/keyword-illustrations</span>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-muted">
            {prompt?.trim() || "还没有为这个关键词填写专属配图提示词。"}
          </pre>
        </div>
      </div>
    </section>
  );
}
