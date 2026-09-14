-- Due dates are no longer persisted per assignment; they are derived on the
-- fly from the assignment's createdAt plus the duty's rotationInterval and
-- dueWeekday (Stichtag), removing the redundant, drift-prone stored copy.
DROP INDEX IF EXISTS "DutyAssignment_wgId_dueDate_idx";

ALTER TABLE "DutyAssignment" DROP COLUMN "dueDate";

CREATE INDEX "DutyAssignment_wgId_createdAt_idx" ON "DutyAssignment"("wgId", "createdAt");
