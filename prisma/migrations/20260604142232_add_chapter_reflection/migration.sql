-- CreateTable
CREATE TABLE "chapter_reflections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_reflections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_reflections_userId_idx" ON "chapter_reflections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_reflections_userId_chapterId_key" ON "chapter_reflections"("userId", "chapterId");

-- AddForeignKey
ALTER TABLE "chapter_reflections" ADD CONSTRAINT "chapter_reflections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_reflections" ADD CONSTRAINT "chapter_reflections_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
