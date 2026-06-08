import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/user";
import { getActiveSubjectById } from "@/lib/subject";
import { DownloadCertificate } from "./download-button";

function stableCode(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

/** 证书编号：平台 + 学科版本 + 完成年月 + 用户/学科稳定码。 */
function certNo(seed: string, subjectTitle: string, finishedAt: Date): string {
  const subjectCode = subjectTitle.includes("专业版")
    ? "AI-PRO"
    : subjectTitle.includes("普及版")
      ? "AI-POP"
      : "SUBJ";
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  })
    .format(finishedAt)
    .replace("-", "");
  return `ZXCQ-${subjectCode}-${ym}-${stableCode(seed)}`;
}

function minutesBetween(start: Date, end: Date, max: number): number {
  const minutes = Math.ceil((end.getTime() - start.getTime()) / 60000);
  return Math.max(1, Math.min(max, minutes));
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
  const [agg, completedSubmissions, completedReflections] = await Promise.all([
    prisma.keywordProgress.aggregate({
      where: { userId: user.id, subjectId, isCompleted: true },
      _count: { _all: true },
      _avg: { bestFinalScore: true },
      _max: { completedAt: true },
    }),
    prisma.submission.findMany({
      where: {
        userId: user.id,
        status: "COMPLETED",
        keyword: { chapter: { subjectId } },
      },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.chapterReflection.findMany({
      where: { userId: user.id, chapter: { subjectId }, summary: { not: "" } },
      select: { createdAt: true, updatedAt: true },
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
  const no = certNo(`${user.id}:${subject.id}`, subject.title, finishedAt);
  const learningMinutes =
    completedSubmissions.reduce((sum, s) => sum + minutesBetween(s.createdAt, s.updatedAt, 90), 0) +
    completedReflections.reduce((sum, r) => sum + minutesBetween(r.createdAt, r.updatedAt, 60), 0);

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
          avg={avg}
          dateText={dateText}
          learningMinutes={learningMinutes}
          totalChapters={totalChapters}
          no={no}
        />
      </div>

      {/* 证书主体（打印时即为整页内容） */}
      <div className="mx-auto mt-6 max-w-5xl print:mt-0">
        <div className="relative overflow-hidden rounded-2xl border-4 border-brand-200 bg-surface p-4 shadow-sm sm:p-5 print:border-2 print:shadow-none">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-100/70"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-accent-100/70"
            aria-hidden
          />

          <div className="relative rounded-xl border border-line px-2 py-6 sm:px-5 sm:py-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="flex items-center justify-center gap-2 text-brand-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-extrabold text-white">
                  智
                </span>
                <span className="text-lg font-bold tracking-wide">智学闯关</span>
              </div>

            <div className="mt-8">
              <div className="text-sm font-medium tracking-[0.3em] text-muted">CERTIFICATE</div>
              <h1 className="mt-2 text-4xl font-extrabold text-ink sm:text-5xl">结业证书</h1>
            </div>

            <p className="mt-10 text-base text-muted">兹证明</p>
            <p className="mt-2 text-4xl font-extrabold text-brand-700">{user.name}</p>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink sm:text-lg">
              恭喜你完成
              <span className="font-bold text-brand-700"> {subject.title} </span>
              的完整闯关学习。
            </p>

            <div className="mx-auto mt-8 max-w-2xl border-y border-line py-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium text-muted">平均终评分</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-accent-700">{avg}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">关键词地图</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                    {totalKeywords} 词
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">完成章节</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                    {totalChapters} 章
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">学习时长</dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                    {learningMinutes} 分钟
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-7 flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
              <div className="text-left">
                <div>
                  完成日期 <span className="font-semibold text-ink">{dateText}</span>
                </div>
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
        </div>

        <p className="mt-4 text-center text-xs text-muted print:hidden">
          点击右上角「下载证书图片」，即可把证书保存为 PNG 图片留存。
        </p>
      </div>
    </main>
  );
}
