import { createTestDatabase } from './support/prisma-pglite.mjs'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { db, close } = await createTestDatabase()
try {
  await db.exec(readFileSync('tmp/weekly-baseline.sql', 'utf8'))
  await db.exec(readFileSync('prisma/migrations/20261101230000_weekly_duty_plan/migration.sql', 'utf8'))
  await db.exec(readFileSync('prisma/migrations/20261102230000_hosting_runtime_access/migration.sql', 'utf8'))
  await db.exec(`INSERT INTO "WGConfig" (id,name,"inviteCode") VALUES ('wg-a','A','a'),('wg-b','B','b');
    INSERT INTO "User" (id,name,email,"passwordHash", "updatedAt","wgId") VALUES ('a','Person A','a@example.invalid','test-only',now(),'wg-a'),('b','Person B','b@example.invalid','test-only',now(),'wg-b');
    INSERT INTO wg_hosting.runtime_scope VALUES ('wg_zuhause_runtime','wg-a');
    INSERT INTO "PasswordResetToken" (id,email,token,"expiresAt") VALUES ('ra','a@example.invalid','synthetic-a',now()),('rb','b@example.invalid','synthetic-b',now());
    INSERT INTO "PushSubscription" (id,"userId",endpoint,p256dh,auth) VALUES ('pa','a','https://example.invalid/a','synthetic','synthetic'),('pb','b','https://example.invalid/b','synthetic','synthetic');`)
  await db.exec(readFileSync('prisma/migrations/20261102231000_hosting_notification_cutover/migration.sql', 'utf8'))
  await db.exec(`INSERT INTO "WeeklyDutyPlan" ("wgId","startMonday","memberOrder","dutyOrder") VALUES ('wg-a','2026-11-02',ARRAY['a','two','three','four','five'],ARRAY['one','two','three','four']);`)
  await assert.rejects(db.exec(`INSERT INTO "Notification" (id,"wgId","userId",type,message) VALUES ('legacy','wg-a','a','ICAL_REMINDER','test')`), /managed by the new hosting/)
  const roles = await db.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='wg_zuhause_runtime'")
  assert.deepEqual(roles.rows[0], { rolsuper:false, rolcreatedb:false, rolcreaterole:false, rolbypassrls:false, rolcanlogin:false })
  await db.exec('SET ROLE wg_zuhause_runtime')
  await db.exec(`INSERT INTO "Notification" (id,"wgId","userId",type,message) VALUES ('new','wg-a','a','ICAL_REMINDER','test')`)
  assert.deepEqual((await db.query('SELECT id FROM "User"')).rows,[{id:'a'}])
  assert.deepEqual((await db.query('SELECT id FROM "WGConfig"')).rows,[{id:'wg-a'}])
  assert.deepEqual((await db.query('SELECT id FROM "PasswordResetToken"')).rows,[{id:'ra'}])
  assert.deepEqual((await db.query('SELECT id FROM "PushSubscription"')).rows,[{id:'pa'}])
  await assert.rejects(db.exec(`INSERT INTO "ShoppingItem" (id,"wgId",name,"addedBy") VALUES ('bad','wg-b','test','b')`), /row-level security/)
  await db.exec(`INSERT INTO "ShoppingItem" (id,"wgId",name,"addedBy") VALUES ('good','wg-a','test','a')`)
  await assert.rejects(db.exec('CREATE TABLE public.unauthorized_test (id text)'), /permission denied/)
  await assert.rejects(db.exec('CREATE ROLE unauthorized_test'), /permission denied/)
  await assert.rejects(db.exec("UPDATE wg_hosting.runtime_scope SET wg_id='wg-b'"), /permission denied/)
  console.log('PASS: server role restricted to one WG including users/tokens/subscriptions; cross-WG writes denied; scope immutable to app; no schema/role/admin/bypass rights.')
} finally { await close() }
