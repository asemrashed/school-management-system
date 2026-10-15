-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('draft', 'pending', 'published', 'rejected');

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "NoticeStatus" NOT NULL DEFAULT 'published';

-- CreateIndex
CREATE INDEX "Notice_status_idx" ON "Notice"("status");
