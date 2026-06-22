import { prisma } from "@/lib/db";
import { parseTags } from "@/lib/memory-diff";

export function averageSnapshotScore(snapshots: { finalScore: number }[]) {
  if (snapshots.length === 0) return 0;
  const avg = snapshots.reduce((sum, s) => sum + s.finalScore, 0) / snapshots.length;
  return Math.round(avg * 10) / 10;
}

export async function getGrowthTimeline(userId: string) {
  const [memory, snapshots] = await Promise.all([
    prisma.employeeMemory.findUnique({ where: { userId } }),
    prisma.employeeMemorySnapshot.findMany({
      where: { userId },
      orderBy: { seq: "asc" },
    }),
  ]);

  return {
    memory,
    snapshots,
    tags: parseTags(memory?.tags),
    latest: snapshots.at(-1) ?? null,
    avgScore: averageSnapshotScore(snapshots),
  };
}
