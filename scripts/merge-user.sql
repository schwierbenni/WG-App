-- One-off, transactional account merge. Caller supplies transaction-local
-- wg.merge_source, wg.merge_target and wg.merge_wg. Never print backup rows.
-- Execute inside BEGIN/COMMIT only after the final deletion confirmation.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS wg_hosting.account_merge_runs (
  id uuid PRIMARY KEY, source_id text NOT NULL, target_id text NOT NULL,
  wg_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS wg_hosting.account_merge_rows (
  run_id uuid NOT NULL REFERENCES wg_hosting.account_merge_runs(id),
  table_name text NOT NULL, row_id text NOT NULL, before_row jsonb NOT NULL,
  PRIMARY KEY (run_id, table_name, row_id)
);
REVOKE ALL ON wg_hosting.account_merge_runs, wg_hosting.account_merge_rows FROM PUBLIC;
ALTER TABLE wg_hosting.account_merge_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wg_hosting.account_merge_rows ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  source_id text := current_setting('wg.merge_source');
  target_id text := current_setting('wg.merge_target');
  wg_id text := current_setting('wg.merge_wg');
  run_id uuid := gen_random_uuid();
  source_email text;
  target_before jsonb;
  item record;
  current_table_name text;
  predicate text;
  locked_tables text;
  old_count bigint;
  new_count bigint;
  before_counts jsonb := '{}'::jsonb;
  old_tokens bigint;
  game_count bigint;
  game_points bigint;
BEGIN
  IF source_id = target_id OR source_id = '' OR target_id = '' THEN
    RAISE EXCEPTION 'Source and target must be distinct accounts';
  END IF;
  SELECT string_agg(format('public.%I', t), ', ' ORDER BY t) INTO locked_tables
  FROM (
    SELECT r.relname::text t FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    WHERE c.contype='f' AND c.confrelid='public."User"'::regclass
    UNION SELECT unnest(ARRAY['User','Duty','WeeklyDutyPlan','InviteToken','PasswordResetToken'])
  ) tables_to_lock;
  EXECUTE 'LOCK TABLE ' || locked_tables || ' IN SHARE ROW EXCLUSIVE MODE';
  SELECT email INTO STRICT source_email FROM public."User" WHERE id=source_id AND "wgId"=wg_id;
  SELECT to_jsonb(u) INTO STRICT target_before FROM public."User" u WHERE id=target_id AND "wgId"=wg_id;
  IF lower(source_email) = lower(target_before->>'email') THEN
    RAISE EXCEPTION 'Email identities overlap; token handling needs explicit review';
  END IF;
  IF EXISTS (SELECT 1 FROM public."GameResult" a JOIN public."GameResult" b USING ("gameSessionId") WHERE a."userId"=source_id AND b."userId"=target_id)
    OR EXISTS (SELECT 1 FROM public."Expense" WHERE source_id=ANY("splitWith") AND target_id=ANY("splitWith"))
    OR EXISTS (SELECT 1 FROM public."Expense" WHERE splits::jsonb ? source_id AND splits::jsonb ? target_id)
    OR EXISTS (SELECT 1 FROM public."AnnouncementReaction" a JOIN public."AnnouncementReaction" b USING ("announcementId",emoji) WHERE a."userId"=source_id AND b."userId"=target_id)
    OR EXISTS (SELECT 1 FROM public."WeeklyDutyPlan" WHERE source_id=ANY("memberOrder") AND target_id=ANY("memberOrder"))
  THEN RAISE EXCEPTION 'Account merge collision; no data changed'; END IF;
  SELECT count(*),coalesce(sum(points),0) INTO game_count,game_points FROM public."GameResult" WHERE "userId" IN (source_id,target_id);
  SELECT count(*) INTO old_tokens FROM public."PasswordResetToken" WHERE lower(email)=lower(source_email);
  INSERT INTO wg_hosting.account_merge_runs (id,source_id,target_id,wg_id) VALUES (run_id,source_id,target_id,wg_id);
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'User',id,to_jsonb(u) FROM public."User" u WHERE id IN (source_id,target_id);
  FOR item IN
    SELECT r.relname AS tab, array_agg(a.attname::text ORDER BY a.attname) AS cols
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='public."User"'::regclass GROUP BY r.relname ORDER BY r.relname
  LOOP
    SELECT string_agg(format('%I = %L',col,source_id),' OR ') INTO predicate FROM unnest(item.cols) col;
    EXECUTE format('INSERT INTO wg_hosting.account_merge_rows SELECT $1,%L,id,to_jsonb(t) FROM public.%I t WHERE %s ON CONFLICT DO NOTHING',item.tab,item.tab,predicate) USING run_id;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=item.tab AND column_name='wgId') THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE (%s) AND "wgId" <> $1',item.tab,predicate) INTO old_count USING wg_id;
      IF old_count <> 0 THEN RAISE EXCEPTION 'Cross-WG reference in %',item.tab; END IF;
    END IF;
  END LOOP;
  -- References not represented by a Prisma/PostgreSQL foreign key.
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'DutyAssignment',id,to_jsonb(t) FROM public."DutyAssignment" t WHERE "completedBy"=source_id ON CONFLICT DO NOTHING;
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'InviteToken',id,to_jsonb(t) FROM public."InviteToken" t WHERE "createdBy"=source_id ON CONFLICT DO NOTHING;
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'Duty',id,to_jsonb(t) FROM public."Duty" t WHERE source_id=ANY("rotationOrder") ON CONFLICT DO NOTHING;
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'WeeklyDutyPlan',"wgId",to_jsonb(t) FROM public."WeeklyDutyPlan" t WHERE source_id=ANY("memberOrder") ON CONFLICT DO NOTHING;
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'Expense',id,to_jsonb(t) FROM public."Expense" t WHERE source_id=ANY("splitWith") OR splits::jsonb ? source_id ON CONFLICT DO NOTHING;
  INSERT INTO wg_hosting.account_merge_rows SELECT run_id,'PasswordResetToken',id,to_jsonb(t) FROM public."PasswordResetToken" t WHERE lower(email)=lower(source_email) ON CONFLICT DO NOTHING;
  FOR current_table_name IN SELECT DISTINCT t FROM (
    SELECT r.relname::text t FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid WHERE c.contype='f' AND c.confrelid='public."User"'::regclass
    UNION SELECT unnest(ARRAY['User','Duty','WeeklyDutyPlan','InviteToken','PasswordResetToken'])
  ) tables_to_count LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',current_table_name) INTO old_count;
    before_counts := before_counts || jsonb_build_object(current_table_name,old_count);
  END LOOP;
  FOR item IN SELECT r.relname AS tab,a.attname AS col FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='public."User"'::regclass ORDER BY r.relname,a.attname LOOP
    EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2',item.tab,item.col,item.col) USING target_id,source_id;
  END LOOP;
  UPDATE public."DutyAssignment" SET "completedBy"=target_id WHERE "completedBy"=source_id;
  UPDATE public."InviteToken" SET "createdBy"=target_id WHERE "createdBy"=source_id;
  UPDATE public."Expense" SET "splitWith"=array_replace("splitWith",source_id,target_id) WHERE source_id=ANY("splitWith");
  UPDATE public."Expense" SET splits=(splits::jsonb-source_id)||jsonb_build_object(target_id,splits::jsonb->source_id) WHERE splits::jsonb ? source_id;
  UPDATE public."WeeklyDutyPlan" SET "memberOrder"=array_replace("memberOrder",source_id,target_id) WHERE source_id=ANY("memberOrder");
  UPDATE public."Duty" d SET "rotationOrder"=ARRAY(
    SELECT v FROM unnest(array_replace(d."rotationOrder",source_id,target_id)) WITH ORDINALITY q(v,ord)
    WHERE v<>target_id OR ord=(SELECT min(p) FROM unnest(array_replace(d."rotationOrder",source_id,target_id)) WITH ORDINALITY z(x,p) WHERE x=target_id)
    ORDER BY ord
  ) WHERE source_id=ANY(d."rotationOrder");
  FOR item IN SELECT r.relname AS tab,a.attname AS col FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] WHERE c.contype='f' AND c.confrelid='public."User"'::regclass LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=$1',item.tab,item.col) INTO old_count USING source_id;
    IF old_count<>0 THEN RAISE EXCEPTION 'Reference remains in %.%',item.tab,item.col; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public."DutyAssignment" WHERE "completedBy"=source_id)
    OR EXISTS(SELECT 1 FROM public."InviteToken" WHERE "createdBy"=source_id)
    OR EXISTS(SELECT 1 FROM public."Duty" WHERE source_id=ANY("rotationOrder"))
    OR EXISTS(SELECT 1 FROM public."WeeklyDutyPlan" WHERE source_id=ANY("memberOrder"))
    OR EXISTS(SELECT 1 FROM public."Expense" WHERE source_id=ANY("splitWith") OR splits::jsonb ? source_id)
  THEN RAISE EXCEPTION 'An untyped reference remains'; END IF;
  DELETE FROM public."PasswordResetToken" WHERE lower(email)=lower(source_email);
  DELETE FROM public."User" WHERE id=source_id AND "wgId"=wg_id;
  IF (SELECT to_jsonb(u) FROM public."User" u WHERE id=target_id) IS DISTINCT FROM target_before THEN RAISE EXCEPTION 'Target identity changed'; END IF;
  SELECT count(*),coalesce(sum(points),0) INTO old_count,new_count FROM public."GameResult" WHERE "userId"=target_id;
  IF old_count<>game_count OR new_count<>game_points THEN RAISE EXCEPTION 'Game totals changed'; END IF;
  FOR item IN SELECT key,value FROM jsonb_each(before_counts) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',item.key) INTO new_count;
    old_count := (item.value#>>'{}')::bigint - CASE item.key WHEN 'User' THEN 1 WHEN 'PasswordResetToken' THEN old_tokens ELSE 0 END;
    IF new_count<>old_count THEN RAISE EXCEPTION 'Unexpected row loss in %',item.key; END IF;
  END LOOP;
  UPDATE wg_hosting.account_merge_runs SET summary=jsonb_build_object('game_results',game_count,'game_points',game_points,'revoked_old_reset_tokens',old_tokens,'reference_check','passed','row_count_check','passed','target_identity_check','passed') WHERE id=run_id;
END $$;
