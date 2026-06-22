-- AlterTable: make content optional, add task fields
ALTER TABLE "Announcement" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "Announcement" ADD COLUMN "title" TEXT;
ALTER TABLE "Announcement" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD COLUMN "assignedUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BULLETIN_TASK';
