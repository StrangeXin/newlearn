import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { getActiveSubjectById } from "@/lib/subject";
import { weekIndexFor } from "@/lib/schedule";
import { DownloadCertificate } from "./download-button";

/** 证书编号：由用户与学科 id 确定性派生，同一张证书每次一致。 */
function certNo(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return "AI-" + h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const user = await requireUser();

  const subjectBase = await getActiveSubjectById(subjectId);
  if (!subjectBase) redirect("/learn");
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { chapters: { select: { _count: { select: { keywords: true } } } } },
  });
  if (!subject) redirect("/learn");

  const totalKeywords = subject.chapters.reduce((s, c) => s + c._count.keywords, 0);
  const totalChapters = subject.chapters.length;

  // 结业门槛：该学科 100 词全部通过
  const [agg, reflected] = await Promise.all([
    prisma.keywordProgress.aggregate({
      where: { userId: user.id, subjectId, isCompleted: true },
      _count: { _all: true },
      _avg: { bestFinalScore: true },
      _max: { completedAt: true },
    }),
    prisma.chapterReflection.count({
      where: { userId: user.id, chapter: { subjectId }, summary: { not: "" } },
    }),
  ]);
  const completed = agg._count._all;
  // 未学完则没有证书，回到该学科地图
  if (totalKeywords === 0 || completed < totalKeywords) redirect(`/learn/${subjectId}`);

  const avg = Math.round((agg._avg.bestFinalScore ?? 0) * 10) / 10;
  const finishedAt = agg._max.completedAt ?? new Date();
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(finishedAt);
  const week = subject.startDate ? weekIndexFor(subject.startDate, finishedAt) : null;
  const reflectionDone = reflected >= totalChapters;
  const no = certNo(`${user.id}:${subject.id}`);

  return (
    <main className="page py-8 print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/learn/${subjectId}`}
          className="text-sm font-medium text-muted transition hover:text-brand-700"
        >
          ← 返回闯关地图
        </Link>
        <DownloadCertificate
          name={user.name}
          subjectTitle={subject.title}
          totalKeywords={totalKeywords}
          completed={completed}
          avg={avg}
          dateText={dateText}
          week={week}
          totalChapters={totalChapters}
          reflected={reflected}
          reflectionDone={reflectionDone}
          no={no}
        />
      </div>

      {/* 证书主体（打印时即为整页内容） */}
      <div className="mx-auto mt-6 max-w-5xl print:mt-0">
        <div className="relative overflow-hidden rounded-2xl border-4 border-brand-200 bg-surface p-8 text-center shadow-sm sm:p-12 print:border-2 print:shadow-none">
          {/* 角标装饰 */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent-100/60"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-brand-100/60"
            aria-hidden
          />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 text-brand-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-extrabold text-white">
                智
              </span>
              <span className="text-lg font-bold tracking-wide">智学闯关</span>
            </div>

            <div className="mt-7">
              <div className="text-sm font-medium tracking-[0.3em] text-muted">CERTIFICATE</div>
              <h1 className="mt-2 text-3xl font-extrabold text-ink sm:text-4xl">结业证书</h1>
            </div>

            <p className="mt-9 text-base text-muted">兹证明</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-700">{user.name}</p>
            <p className="mt-5 whitespace-nowrap text-base text-ink sm:text-lg">
              已完成
              <span className="font-bold text-brand-700"> {subject.title} </span>
              全部 <span className="font-bold tabular-nums">{totalKeywords}</span> 个关键词的学习与考核
              {reflectionDone && <>，并完成全部 {totalChapters} 章反思</>}。
            </p>

            {/* 数据栏 */}
            <dl className="mx-auto mt-9 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-6 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-muted">通过关键词</dt>
                <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                  {completed}/{totalKeywords}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">平均分</dt>
                <dd className="mt-1 text-xl font-extrabold tabular-nums text-accent-700">{avg}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">章节</dt>
                <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                  {totalChapters} 章
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">章节反思</dt>
                <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                  {reflected}/{totalChapters}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
              <div className="text-left">
                <div>
                  完成日期 <span className="font-semibold text-ink">{dateText}</span>
                </div>
                {week && (
                  <div className="mt-0.5">
                    用时 第 <span className="font-semibold text-ink tabular-nums">{week}</span> 周完成
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs">证书编号</div>
                  <div className="font-mono font-semibold tracking-wider text-ink">{no}</div>
                </div>
                {/* 印章 */}
                <span
                  className="flex h-16 w-16 rotate-[-8deg] items-center justify-center rounded-full border-2 border-accent-400 text-center text-[11px] font-bold leading-tight text-accent-700"
                  aria-hidden
                >
                  智学闯关
                  <br />
                  结业认证
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted print:hidden">
          点击右上角「下载证书图片」，即可把证书保存为 PNG 图片留存。
        </p>
      </div>
    </main>
  );
}
