-- Retain subscriptions from the old website; new keys only target the new origin.
ALTER TABLE "PushSubscription" ADD COLUMN "applicationOrigin" TEXT;
-- Old deployments may keep invoking scheduled routes. Reject legacy automatic
-- notification writes before their awaited create/createMany finishes and before
-- those routes can send push. Applies only after a fixed weekly plan is active.
CREATE FUNCTION wg_hosting.guard_legacy_automatic_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_user <> 'wg_zuhause_runtime'
    AND NEW.type::text IN ('ASSIGNMENT','REMINDER','ICAL_REMINDER','WG_EVENT','BULLETIN_TASK')
    AND EXISTS (SELECT 1 FROM wg_hosting.runtime_scope s WHERE s.role_name = 'wg_zuhause_runtime' AND s.wg_id = NEW."wgId")
    AND EXISTS (SELECT 1 FROM public."WeeklyDutyPlan" p WHERE p."wgId" = NEW."wgId")
  THEN
    RAISE EXCEPTION 'Automatic notices for this WG are managed by the new hosting instance';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION wg_hosting.guard_legacy_automatic_notice() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wg_hosting.guard_legacy_automatic_notice() TO wg_zuhause_runtime;
CREATE TRIGGER guard_legacy_automatic_notice BEFORE INSERT ON public."Notification"
FOR EACH ROW EXECUTE FUNCTION wg_hosting.guard_legacy_automatic_notice();
