ALTER TABLE "Expense" ADD COLUMN "gameSessionId" TEXT;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_gameSessionId_fkey"
  FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Expense_gameSessionId_idx" ON "Expense"("gameSessionId");
