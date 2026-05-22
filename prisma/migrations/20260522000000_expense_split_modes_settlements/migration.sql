-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('EQUAL', 'INDIVIDUAL', 'PERCENTAGE');

-- AlterTable: add splitMode and splits to Expense
ALTER TABLE "Expense" ADD COLUMN "splitMode" "SplitMode" NOT NULL DEFAULT 'EQUAL';
ALTER TABLE "Expense" ADD COLUMN "splits" JSONB;

-- CreateTable: Settlement
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "wgId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_wgId_fkey" FOREIGN KEY ("wgId") REFERENCES "WGConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
