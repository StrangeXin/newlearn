/*
  Warnings:

  - You are about to drop the `active_subject_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "active_subject_config" DROP CONSTRAINT "active_subject_config_activeSubjectId_fkey";

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "active_subject_config";

-- CreateIndex
CREATE INDEX "subjects_isActive_idx" ON "subjects"("isActive");
