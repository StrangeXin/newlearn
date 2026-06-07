-- CreateTable
CREATE TABLE "redemption_attachments" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemption_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redemption_attachments_redemptionId_key" ON "redemption_attachments"("redemptionId");

-- AddForeignKey
ALTER TABLE "redemption_attachments" ADD CONSTRAINT "redemption_attachments_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "redemptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
