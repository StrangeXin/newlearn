-- CreateEnum
CREATE TYPE "RedemptionCategory" AS ENUM ('BOOK', 'TOOL', 'COURSE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackSentiment" AS ENUM ('UP', 'MEH', 'DOWN');

-- AlterTable
ALTER TABLE "redemptions" ADD COLUMN     "category" "RedemptionCategory" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "redemption_feedback" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentiment" "FeedbackSentiment",
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemption_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "redemption_feedback_redemptionId_idx" ON "redemption_feedback"("redemptionId");

-- AddForeignKey
ALTER TABLE "redemption_feedback" ADD CONSTRAINT "redemption_feedback_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemption_feedback" ADD CONSTRAINT "redemption_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
