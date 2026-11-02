-- Dedicated server role; no password or resident identifiers in this migration.
CREATE ROLE wg_zuhause_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 8;
GRANT CONNECT ON DATABASE postgres TO wg_zuhause_runtime;
GRANT USAGE ON SCHEMA public TO wg_zuhause_runtime;
CREATE SCHEMA wg_hosting;
REVOKE ALL ON SCHEMA wg_hosting FROM PUBLIC;
CREATE TABLE wg_hosting.runtime_scope (role_name name PRIMARY KEY, wg_id text NOT NULL REFERENCES public."WGConfig"(id));
REVOKE ALL ON TABLE wg_hosting.runtime_scope FROM PUBLIC;
GRANT USAGE ON SCHEMA wg_hosting TO wg_zuhause_runtime;
GRANT SELECT ON wg_hosting.runtime_scope TO wg_zuhause_runtime;
ALTER TABLE wg_hosting.runtime_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_scope_read ON wg_hosting.runtime_scope FOR SELECT TO wg_zuhause_runtime USING (role_name = current_user);
DO $$
DECLARE app_table text; scope_expression text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY['WGConfig','User','Duty','DutySwapIOU','DutyAssignment','SwapRequest','Announcement','AnnouncementReaction','ShoppingItem','WGExpenseCategory','Expense','Settlement','Notification','PasswordResetToken','InviteToken','PushSubscription','SpotifyPlaylist','ICalCalendar','ICalEvent','GameSession','GameResult','WGEvent','WeeklyDutyPlan'] LOOP
    scope_expression := CASE app_table
      WHEN 'WGConfig' THEN 'id = (SELECT wg_id FROM wg_hosting.runtime_scope WHERE role_name = current_user)'
      WHEN 'PushSubscription' THEN 'EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "PushSubscription"."userId")'
      WHEN 'PasswordResetToken' THEN 'EXISTS (SELECT 1 FROM public."User" u WHERE u.email = "PasswordResetToken".email)'
      WHEN 'AnnouncementReaction' THEN 'EXISTS (SELECT 1 FROM public."Announcement" a WHERE a.id = "AnnouncementReaction"."announcementId") AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "AnnouncementReaction"."userId")'
      WHEN 'GameResult' THEN 'EXISTS (SELECT 1 FROM public."GameSession" s WHERE s.id = "GameResult"."gameSessionId") AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = "GameResult"."userId")'
      ELSE '"wgId" = (SELECT wg_id FROM wg_hosting.runtime_scope WHERE role_name = current_user)'
    END;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO wg_zuhause_runtime', app_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('CREATE POLICY wg_zuhause_runtime_access ON public.%I FOR ALL TO wg_zuhause_runtime USING (%s) WITH CHECK (%s)', app_table, scope_expression, scope_expression);
    EXECUTE format('CREATE POLICY wg_zuhause_runtime_boundary ON public.%I AS RESTRICTIVE FOR ALL TO wg_zuhause_runtime USING (%s) WITH CHECK (%s)', app_table, scope_expression, scope_expression);
  END LOOP;
END $$;
