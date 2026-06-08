import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/user";
import { getLearnerRoster } from "@/lib/stats";
import { getActiveSubjects } from "@/lib/subject";
import { SubjectTabs } from "@/components/subject-tabs";
import { LearnerTable } from "./learner-table";

// 管理后台「员工学情」花名册：按学科逐人展示进度/均分/积分/状态/最近活跃，
// 搜索/筛选/排序在客户端即时进行（数据一次性取出，≤全员规模）。
export default async function AdminLearnersPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  await requireAdmin();
  const subjects = await getActiveSubjects();
  if (subjects.length === 0) redirect("/admin");
  const { subject: requested } = await searchParams;
  const subject = subjects.find((s) => s.id === requested) ?? subjects[0];
  const roster = await getLearnerRoster(subject.id);

  const started = roster.rows.filter((r) => r.status !== "inactive" && r.completed > 0).length;

  return (
    <main className="page py-8">
      <Link href="/admin" className="text-sm font-medium text-muted transition hover:text-brand-700">
        ← 管理后台
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ink">员工学情</h1>
      <p className="mt-1 mb-4 text-sm text-muted">
        逐人查看学习进度与成长轨迹。学科：{subject.title} · 第{" "}
        <span className="tabular-nums">{roster.currentWeek}</span> 周 · 全员{" "}
        <span className="tabular-nums">{roster.rows.length}</span> 人，已开始{" "}
        <span className="tabular-nums">{started}</span> 人 · 点开任一人看 360° 详情。
      </p>
      <SubjectTabs subjects={subjects} activeId={subject.id} basePath="/admin/learners" />

      <LearnerTable rows={roster.rows} totalKeywords={roster.totalKeywords} subjectId={subject.id} />
    </main>
  );
}
