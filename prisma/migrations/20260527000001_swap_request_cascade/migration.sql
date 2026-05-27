-- Fix: deleting a Duty failed because SwapRequest.assignmentId had no ON DELETE CASCADE.
-- When Duty is deleted → DutyAssignment cascades → SwapRequest blocked with FK violation.

ALTER TABLE "SwapRequest" DROP CONSTRAINT "SwapRequest_assignmentId_fkey";
ALTER TABLE "SwapRequest"
  ADD CONSTRAINT "SwapRequest_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "DutyAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
