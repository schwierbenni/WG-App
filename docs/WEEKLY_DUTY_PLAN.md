# Fixed weekly duty plan

## Product contract · 2026-11-01

Five room-order positions share four duties and one free slot. A WG admin maps actual account IDs to the five positions; names and nicknames are never guessed or joined automatically. In the requested first week, position 1 is free; positions 2–5 get bathroom, living room, supply and kitchen respectively. Requested start Monday: **2026-11-02**. Every following Monday each duty advances to the next member in the room order. Everyone has every duty and one free week in each five-week cycle.

- Weeks run Monday–Sunday in Europe/Berlin. The deadline is Sunday 23:59:59.999. Monday is a full grace day. Tuesday begins the second escalation.
- Monday morning: private weekly-role notification to each member, including the free person. Role notices are not queued before 07:00 Berlin time; the existing 06:00 UTC daily cron runs at 07:00 winter / 08:00 summer. Opening dashboard/duties also catches up a missing run.
- Sunday at 09:00 Europe/Berlin: group reminder for each still-open duty. Monday: first group escalation for an unfinished old duty. Tuesday: second group escalation if it remains unfinished. Stage messages are deduplicated per assignment/stage/recipient. Missed obsolete reminder stages are not replayed together later.
- On-time completion broadcasts the requested Good Boy message. Late completion says the duty was made up. The two overdue stages use the explicitly requested vulgar WG wording from the domain helper. These messages are visible only within the authenticated WG.
- Only the actual assignee can complete/reopen a duty, including when the caller is an admin. Completion is atomic and repeated requests do not repeat the broadcast. Reopening does not erase previously delivered history.
- A new week starts regardless of old completion. Old unfinished weeks remain as backlog, never silently reassigned or deleted. Missing weeks after downtime are generated from the original anchor. Pre-plan assignments are preserved and separately reachable; they do not receive retroactive weekly escalation messages.

## Architecture and integrity

`WeeklyDutyPlan` stores one immutable anchor/member-order/duty-order per WG. Setup validates five distinct same-WG accounts, four distinct active non-paused same-WG duties and a real Monday. It never matches names. Assignments have a nullable weekStart date and a unique (dutyId, weekStart), so existing records remain valid. New plans cannot silently replace an already active plan.

Legacy independent rotation is bypassed for a WG with a weekly plan. Manual assignment/rotation and swaps cannot override weekly slots; legacy swap IOUs do not change the fixed cycle. Planned duty deletion/pause/independent rescheduling and deletion of planned members are rejected, preserving history and plan integrity. Membership/plan changes after an exit need a separately agreed plan revision; this initial version deliberately has no destructive reset.

A WG row lock serializes allocation generation; assignment row locks serialize completion against reminders. Notification delivery keys deduplicate in-app notices. Pending push notices form a durable outbox; row locks prevent concurrent dispatchers taking the same notice. A failed push remains queued and is retried by the next cron/page visit. No-subscription users still have the in-app notification. Device-level exactly-once delivery cannot be guaranteed: a crash after an accepted push and before its database acknowledgement may resend it, and partial subscription failure can retry a previously successful subscription. Late undelivered reminders are cancelled when that duty is completed.

New table RLS is enabled and public/anon/authenticated table privileges are revoked; the application uses its authenticated server PostgreSQL connection. Target database privileges must be verified during rollout. No secrets or resident records are in fixtures or tests. Browser fixtures use only synthetic Person 0–4.

## Checks performed

- Fourteen domain tests: start/following week, 20 weeks/five-week fairness, duplicate/unaligned input, Berlin week boundary, full grace day including both DST transitions and year boundary, message stages.
- PostgreSQL integration using PGlite 0.5.14 (embedded PostgreSQL) and the real generated Prisma client/PrismaPg adapter. The small test-only bridge translates pg queries to PGlite. Real migration applied locally to the original schema with existing synthetic records. Exercised actual weekly service and API handlers: midnight versus morning, independent new week, backlog, completion/undo authorization, same-WG restrictions, duplicate calls, late completion, catch-up, durable retry, invalid/cross-WG/positive admin setup, immutable setup, unique slots and RLS. This single-session test is not a multi-connection production load test; concurrency relies additionally on reviewed PostgreSQL row locks/constraints.
- Six Edge/WebKit cases (390/820/1440), Light/Dark, reduced motion, actual touch completion, self-only controls even for admin, undo, backlog clearing, next-week preview, setup IDs and no horizontal overflow. Actual DutiesPage + WeeklyDutyBoard; only auth/navigation and HTTP responses are fixtures. Screenshots alongside this document.
- TypeScript, new-file ESLint and full production webpack build passed. Existing modified-file lint findings reproduce the unchanged baseline: one set-state-in-effect error in the old DutiesPage fetch effect and one unused session warning in the old assignment-creation route. No new findings remain; no full-repository lint-green claim.
- No production database was opened, no real push sent, no resident records read, no production migration/deployment performed. Vercel preview access remains owner-protected as documented for #76.

## Reproduce

Use existing project dependency setup (`npm ci` and `prisma generate`). No new production dependency is introduced. Test-only tools can live under ignored `.tools/` with caches/temp explicitly kept inside this project:

```text
pnpm --dir .tools/test-db add @electric-sql/pglite@0.5.14 --ignore-scripts
pnpm exec tsx --test tests/weekly-duty.test.ts
node tests/weekly-duty.integration.mjs
pnpm --dir .tools/browser-test add vite@8.2.1 @playwright/test@1.62.1 --ignore-scripts
node tests/browser/weekly/serve.mjs
node tests/browser/weekly/run.mjs
```

The browser runner needs the installed Edge channel and a WebKit Playwright browser in the project-designated browser cache. An existing read-only toolchain may be selected with WG_TEST_TOOLCHAIN pointing at its package.json. Local tests used an already installed shared browser/tool runtime; no global install. Integration tests derive the baseline schema from repository commit d8407a18bf61bee95ae55e720fbf35d91524286f and never connect to a remote database.

## Rollout – pending owner access

1. Merge/deploy prerequisite #76 or preserve that branch as the base; this feature reuses its tested Berlin-day helper.
2. Confirm target WG database/environment, backup, existing migration history and server-role access. Apply versioned migration `20261101230000_weekly_duty_plan` with the existing trusted migration procedure. Do not run db:reset, db:push or seed against production. There are no production fixtures to apply. This migration adds nullable columns and the new plan table; it does not rewrite/delete assignments.
3. Deploy the tested application commit to a database-migrated preview first. Publishing new code against an unmigrated database would break the new queries. Migration is additive and compatible with the old code, so migration precedes release.
4. WG admin opens Dienste → Gemeinsamen Wochenplan einrichten. Select the five real accounts in the confirmed room order and map the four real duties. Select start Monday 2026-11-02. Review and press Wochenplan verbindlich starten. This persists IDs and may immediately send notices if the start date is already reached; never use real member accounts for a preview notification test.
5. Verify current/following allocation, private/free and group notification recipients, owner-only completion, backlog and configured cron/push subscriptions in the correct environment. Use synthetic accounts in a separate preview DB. Only then merge/release to Main and repeat read-only postflight. The existing schedules remain, with two additional once-daily reminder triggers at 07:00 and 08:00 UTC. Their shared handler runs only on Sunday in the 09:00 Berlin hour: one trigger covers summer time, the other winter time, including transition Sundays. Keys prevent duplicate messages. Vercel Hobby has only hourly scheduling precision (09:00–09:59); minute-accurate 09:00 requires a suitable hosting plan/scheduler. No paid upgrade or protection change is performed.

Until these steps are completed, the requested new plan is **prepared, not active in the live WG**.

## Notification copy revision

Personal role: “Glückwunsch! Du hast diese Woche {duty}.” Free week: “Mashallah einfach frei 🍻”. Sunday reminder: “Eieiei, {name} hat noch keinen {duty} gemacht.” Monday: “{name} ist ein Hurensohn und hat den {duty} nicht geschafft.” Completion, Tuesday escalation and late-completion texts remain unchanged. Timing and exact copy are covered by additional domain and actual cron-handler integration tests. This is part of the prepared feature, not an activated production change.

Revision checks: 14 domain cases and real PostgreSQL/Prisma integration including cron authorization, no Saturday/before-09:00 send, Sunday send and repeated-call deduplication passed. Scoped ESLint, TypeScript and the production webpack build passed. No production configuration changed; the revision remains in the draft feature PR.
