import Link from "next/link";

export interface SubjectTab {
  id: string;
  title: string;
}

/**
 * 学科切换标签条。多学科页面（排行榜/兑换/统计/排名）共用：
 * 高亮当前学科，其余跳到 `${basePath}?${param}=<id>`。仅一个学科时不渲染。
 */
export function SubjectTabs({
  subjects,
  activeId,
  basePath,
  param = "subject",
}: {
  subjects: SubjectTab[];
  activeId: string;
  basePath: string;
  param?: string;
}) {
  if (subjects.length <= 1) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="选择学科">
      {subjects.map((s) => {
        const active = s.id === activeId;
        return (
          <Link
            key={s.id}
            href={`${basePath}?${param}=${s.id}`}
            role="tab"
            aria-selected={active}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-surface text-muted hover:border-brand-300 hover:text-brand-700"
            }`}
          >
            {s.title}
          </Link>
        );
      })}
    </div>
  );
}
