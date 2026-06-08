-- DropForeignKey
ALTER TABLE "points_ledgers" DROP CONSTRAINT "points_ledgers_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "redemptions" DROP CONSTRAINT "redemptions_subjectId_fkey";

-- AlterTable
ALTER TABLE "points_ledgers" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "redemptions" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
