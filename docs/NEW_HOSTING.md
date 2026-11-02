# New hosting instance (2026-11-03)

The requested new project is `wg-zuhause` in Johann's Vercel scope `julkan-s-projects`. It reuses the existing WG Supabase database; no new database, account reset, seed or data deletion is involved. Source is deployed explicitly from the reviewed working branch, not by changing the old owner's Vercel project.

## Database and cutover

The additive weekly-plan migration and the dedicated runtime-access migration were executed through the authenticated Supabase SQL editor after explicit user approval of account/password-hash, token, push, duty, calendar, shopping and expense access. The runtime role has no superuser, database/role creation or RLS-bypass rights. A private immutable scope record plus permissive and restrictive RLS policies constrain it to the selected WG, including tokens and child tables. The app role cannot change this scope. Existing user passwords remain unchanged.

The third migration adds a nullable push origin and an invoker-rights compatibility trigger. Existing subscriptions remain intact. Only subscriptions registered at the new application origin are used with the new VAPID pair. Once a weekly plan exists, legacy automatic notification inserts for that WG are rejected before the old routes can reach their push step. Other WGs and existing notification history are unchanged. At activation the four selected duties must also be switched to MANUAL for the legacy rotation engine; the new fixed weekly engine does not use that interval. Old manual administration should no longer be used.

Applied SQL is retained as versioned Prisma migration files. Execution was manual through the browser, not `prisma migrate deploy`; do not assume Prisma migration history was automatically reconciled. No reset or deploy-migration command was run against production.

## Hosting configuration

Production secrets are stored in Vercel as Secret variables. No plaintext environment/credential export is used. The official CLI was explicitly authorized by the user to configure this project; its project-local login is removed after release. `.vercelignore` excludes helper tools, local authentication, temporary files and environment files. Database access is configured only for production. Preview has its own session secret and no production database URL.

The normal `npm run build` (Turbopack) completes on Vercel. An initial explicit-webpack build compiled but failed Vercel output packaging with a missing route-group manifest; that failed deployment is not released.

## Checks

34 date/rotation/text cases, real PostgreSQL/Prisma weekly integration, calendar cron integration, runtime-role cross-WG read/write denial and immutable scope, and legacy automatic-notification rejection/new-role acceptance pass. The actual middleware callback is tested with valid, invalid and missing cron secrets: only named cron paths accept the configured bearer and ordinary pages retain session protection. Actual push helper queries are tested to select the configured origin only; no real device messages are sent by these tests.

Live sign-in, application data read, configured cron authorization and one-time initial delivery are release postflight checks and must be recorded separately; do not infer them from a successful build. Optional email, OCR and storage-provider credentials from the inaccessible old Vercel project are not copied or guessed.

## Verified live result · 2026-11-03

Production URL: https://wg-zuhause-julkan.vercel.app (a project production domain, not a one-deployment alias). Application source: commit f4f3090. The first production deployment was dpl_6VoDn1R9jkVSechvKcxvQNkbewSX; its regular Turbopack build and promotion succeeded.

The actual Vercel duties cron was invoked once through the authenticated dashboard. Read-only SQL postflight confirmed four weekly assignments anchored at 2026-11-02 and exactly five personal weekly notices, including the corrected Mashallah text. Legacy settings for the four duties were preserved before their old rotation interval was switched to MANUAL. The next stored yellow-bag pickups are 2026-11-19 and 2026-12-10; the new day-before reminder is scheduled for the preceding Berlin calendar day. No calendar reminder was manually fired during this verification.

Public HTTP checks: /login returns 200; anonymous /dashboard redirects to /login; unauthenticated /api/duties/cron returns 401. A synthetic nonexistent-account attempt through the real browser form was correctly rejected. The user then explicitly confirmed successful sign-in with the existing account and the expected living-room duty. Device push receipt is not claimed: the initial database postflight had no subscriptions at the new website; each resident must opt in at the new origin. Existing passwords and old subscriptions were preserved.

A first setup session key was replaced with a fresh, undisplayed production Secret before final handoff. This can require signing in again. Optional password-reset email delivery is not configured in the new project because the old provider credential is unavailable; no such credential was copied or guessed. Upload clients retain their existing public Supabase configuration, but upload/OCR flows were not part of this verified release check.

For a fresh local runtime-access test, first derive the baseline SQL with `pnpm exec prisma migrate diff --from-empty --to-schema tmp/weekly-baseline.prisma --script` after obtaining that schema from baseline commit d8407a18. Then run `node tests/runtime-access.integration.mjs`. This remains a synthetic local test and never connects to production.
