-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING_INITIAL', 'AWAITING_ANSWERS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('BASE', 'RANK_BONUS', 'REDEEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "loginName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActivated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "roleChangedById" TEXT,
    "roleChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_subject_config" (
    "singletonId" TEXT NOT NULL DEFAULT 'GLOBAL',
    "activeSubjectId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "active_subject_config_pkey" PRIMARY KEY ("singletonId")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "description" TEXT,
    "referencePoints" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "noteText" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING_INITIAL',
    "finalScore" INTEGER,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorings" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "finalScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followups" (
    "id" TEXT NOT NULL,
    "scoringId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_progresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "bestFinalScore" INTEGER NOT NULL DEFAULT 0,
    "bestSubmissionId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "keywordProgressId" TEXT,
    "rankingResultId" TEXT,
    "redemptionId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_results" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "bonusAwarded" BOOLEAN NOT NULL DEFAULT false,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "subjectId" TEXT NOT NULL,
    "attachment" TEXT,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_loginName_key" ON "users"("loginName");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "active_subject_config_activeSubjectId_key" ON "active_subject_config"("activeSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_title_key" ON "subjects"("title");

-- CreateIndex
CREATE INDEX "chapters_subjectId_idx" ON "chapters"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_subjectId_index_key" ON "chapters"("subjectId", "index");

-- CreateIndex
CREATE INDEX "keywords_chapterId_idx" ON "keywords"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "keywords_chapterId_term_key" ON "keywords"("chapterId", "term");

-- CreateIndex
CREATE INDEX "submissions_userId_idx" ON "submissions"("userId");

-- CreateIndex
CREATE INDEX "submissions_keywordId_idx" ON "submissions"("keywordId");

-- CreateIndex
CREATE INDEX "submissions_userId_keywordId_idx" ON "submissions"("userId", "keywordId");

-- CreateIndex
CREATE INDEX "submissions_keywordId_status_finalScore_idx" ON "submissions"("keywordId", "status", "finalScore");

-- CreateIndex
CREATE UNIQUE INDEX "scorings_submissionId_key" ON "scorings"("submissionId");

-- CreateIndex
CREATE INDEX "followups_scoringId_idx" ON "followups"("scoringId");

-- CreateIndex
CREATE UNIQUE INDEX "followups_scoringId_order_key" ON "followups"("scoringId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_progresses_bestSubmissionId_key" ON "keyword_progresses"("bestSubmissionId");

-- CreateIndex
CREATE INDEX "keyword_progresses_userId_idx" ON "keyword_progresses"("userId");

-- CreateIndex
CREATE INDEX "keyword_progresses_keywordId_idx" ON "keyword_progresses"("keywordId");

-- CreateIndex
CREATE INDEX "keyword_progresses_keywordId_isCompleted_idx" ON "keyword_progresses"("keywordId", "isCompleted");

-- CreateIndex
CREATE INDEX "keyword_progresses_userId_chapterId_isCompleted_idx" ON "keyword_progresses"("userId", "chapterId", "isCompleted");

-- CreateIndex
CREATE INDEX "keyword_progresses_chapterId_completedAt_idx" ON "keyword_progresses"("chapterId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_progresses_userId_keywordId_key" ON "keyword_progresses"("userId", "keywordId");

-- CreateIndex
CREATE INDEX "points_ledgers_userId_idx" ON "points_ledgers"("userId");

-- CreateIndex
CREATE INDEX "points_ledgers_userId_subjectId_idx" ON "points_ledgers"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "points_ledgers_subjectId_type_idx" ON "points_ledgers"("subjectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledgers_type_keywordProgressId_key" ON "points_ledgers"("type", "keywordProgressId");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledgers_type_rankingResultId_key" ON "points_ledgers"("type", "rankingResultId");

-- CreateIndex
CREATE UNIQUE INDEX "points_ledgers_type_redemptionId_key" ON "points_ledgers"("type", "redemptionId");

-- CreateIndex
CREATE INDEX "ranking_results_subjectId_chapterId_weekIndex_idx" ON "ranking_results"("subjectId", "chapterId", "weekIndex");

-- CreateIndex
CREATE INDEX "ranking_results_userId_idx" ON "ranking_results"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_results_subjectId_chapterId_weekIndex_userId_key" ON "ranking_results"("subjectId", "chapterId", "weekIndex", "userId");

-- CreateIndex
CREATE INDEX "redemptions_userId_idx" ON "redemptions"("userId");

-- CreateIndex
CREATE INDEX "redemptions_status_idx" ON "redemptions"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleChangedById_fkey" FOREIGN KEY ("roleChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_subject_config" ADD CONSTRAINT "active_subject_config_activeSubjectId_fkey" FOREIGN KEY ("activeSubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorings" ADD CONSTRAINT "scorings_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_scoringId_fkey" FOREIGN KEY ("scoringId") REFERENCES "scorings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_progresses" ADD CONSTRAINT "keyword_progresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_progresses" ADD CONSTRAINT "keyword_progresses_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_progresses" ADD CONSTRAINT "keyword_progresses_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_progresses" ADD CONSTRAINT "keyword_progresses_bestSubmissionId_fkey" FOREIGN KEY ("bestSubmissionId") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_keywordProgressId_fkey" FOREIGN KEY ("keywordProgressId") REFERENCES "keyword_progresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_rankingResultId_fkey" FOREIGN KEY ("rankingResultId") REFERENCES "ranking_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_results" ADD CONSTRAINT "ranking_results_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_results" ADD CONSTRAINT "ranking_results_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_results" ADD CONSTRAINT "ranking_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
