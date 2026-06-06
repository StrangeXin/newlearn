-- CreateTable
CREATE TABLE "learner_questions" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_questions_submissionId_idx" ON "learner_questions"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "learner_questions_submissionId_order_key" ON "learner_questions"("submissionId", "order");

-- AddForeignKey
ALTER TABLE "learner_questions" ADD CONSTRAINT "learner_questions_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
