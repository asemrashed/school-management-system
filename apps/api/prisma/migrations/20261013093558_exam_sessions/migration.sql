-- CreateEnum
CREATE TYPE "ExamTerm" AS ENUM ('class_test', 'mid_term', 'final', 'other');

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "marksSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "returnNote" TEXT,
ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "term" "ExamTerm" NOT NULL,
    "classId" TEXT NOT NULL,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSession_classId_idx" ON "ExamSession"("classId");

-- CreateIndex
CREATE INDEX "Exam_sessionId_idx" ON "Exam"("sessionId");

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
