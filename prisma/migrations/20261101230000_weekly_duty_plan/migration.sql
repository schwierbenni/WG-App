-- AlterTable
ALTER TABLE "DutyAssignment" ADD COLUMN     "weekStart" DATE;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deliveryKey" TEXT,
ADD COLUMN     "pushSentAt" TIMESTAMP(3),
ADD COLUMN     "pushTitle" TEXT;

-- CreateTable
CREATE TABLE "WeeklyDutyPlan" (
    "wgId" TEXT NOT NULL,
    "startMonday" DATE NOT NULL,
    "memberOrder" TEXT[],
    "dutyOrder" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyDutyPlan_pkey" PRIMARY KEY ("wgId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DutyAssignment_dutyId_weekStart_key" ON "DutyAssignment"("dutyId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_deliveryKey_key" ON "Notification"("deliveryKey");

-- AddForeignKey
ALTER TABLE "WeeklyDutyPlan" ADD CONSTRAINT "WeeklyDutyPlan_wgId_fkey" FOREIGN KEY ("wgId") REFERENCES "WGConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fixed-size, Monday-anchored plans; no existing assignments are rewritten.
ALTER TABLE "WeeklyDutyPlan" ALTER COLUMN "memberOrder" SET NOT NULL;
ALTER TABLE "WeeklyDutyPlan" ALTER COLUMN "dutyOrder" SET NOT NULL;
ALTER TABLE "WeeklyDutyPlan" ADD CONSTRAINT "WeeklyDutyPlan_shape" CHECK (
  cardinality("memberOrder") = 5 AND cardinality("dutyOrder") = 4
  AND array_position("memberOrder", NULL) IS NULL
  AND array_position("dutyOrder", NULL) IS NULL
  AND EXTRACT(ISODOW FROM "startMonday") = 1
);
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_weekStart_monday" CHECK (
  "weekStart" IS NULL OR EXTRACT(ISODOW FROM "weekStart") = 1
);
-- The app uses its authenticated server connection, not a public Data API.
ALTER TABLE "WeeklyDutyPlan" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "WeeklyDutyPlan" FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
    EXECUTE format('REVOKE ALL ON TABLE "WeeklyDutyPlan" FROM %I', role_name);
  END LOOP;
END $$;
