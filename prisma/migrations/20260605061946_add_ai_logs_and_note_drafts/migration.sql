-- CreateTable
CREATE TABLE "note_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "userId" TEXT,
    "keywordId" TEXT,
    "keywordTerm" TEXT,
    "chapterId" TEXT,
    "submissionId" TEXT,
    "systemPrompt" TEXT,
    "userPrompt" TEXT,
    "responseRaw" TEXT,
    "reasoning" TEXT,
    "parsed" JSONB,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_drafts_userId_idx" ON "note_drafts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "note_drafts_userId_keywordId_key" ON "note_drafts"("userId", "keywordId");

-- CreateIndex
CREATE INDEX "ai_call_logs_createdAt_idx" ON "ai_call_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_userId_idx" ON "ai_call_logs"("userId");

-- CreateIndex
CREATE INDEX "ai_call_logs_keywordId_idx" ON "ai_call_logs"("keywordId");

-- CreateIndex
CREATE INDEX "ai_call_logs_phase_idx" ON "ai_call_logs"("phase");

-- AddForeignKey
ALTER TABLE "note_drafts" ADD CONSTRAINT "note_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_drafts" ADD CONSTRAINT "note_drafts_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;
