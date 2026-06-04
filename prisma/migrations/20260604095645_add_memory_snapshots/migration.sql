-- CreateTable
CREATE TABLE "employee_memory_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordId" TEXT,
    "keywordTerm" TEXT NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "tags" JSONB NOT NULL,
    "portrait" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_memory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_memory_snapshots_userId_seq_idx" ON "employee_memory_snapshots"("userId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "employee_memory_snapshots_userId_seq_key" ON "employee_memory_snapshots"("userId", "seq");

-- AddForeignKey
ALTER TABLE "employee_memory_snapshots" ADD CONSTRAINT "employee_memory_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_memory_snapshots" ADD CONSTRAINT "employee_memory_snapshots_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE SET NULL ON UPDATE CASCADE;
