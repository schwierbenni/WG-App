# Shopping keyboard entry and yellow-bag reminders

## Scope · 2026-11-01

- Explicit Enter submission from item name and note, including the mobile Done hint. Empty input, IME composition, repeated keys and concurrent submissions do not add extra items. Successful submission restores focus to the item name. Existing submit button and API stay unchanged.
- Only imported events explicitly named Gelber Sack / Gelbe Säcke (including inflected forms) receive the extra day-before reminder. Other imported events retain their same-day reminders. Tomorrow means the next calendar day in Europe/Berlin, including DST and year boundaries; the text explicitly says collection is tomorrow morning.
- `/api/calendar/cron` owns the yellow-bag day-before reminder and existing WG events. `/api/ical/cron` owns same-day imported events. The duplicate same-day loop was removed from the former; Vercel schedules remain unchanged (07:00 UTC for each route). This is 08:00 in winter and 09:00 in summer in Berlin.
- Cron endpoints reject missing server configuration as well as unauthorized requests. No database migration, production data access, schedule changes or real push test was performed.

## Current duty rotation (unchanged)

Each duty has its own rotationOrder and interval. Automatic rotation checks active, non-paused, non-MANUAL duties daily and whenever the duties API is read. It requires both a reached due date and a completed latest assignment. A late unfinished duty remains assigned and gets a one-time overdue reminder. Empty order or missing initial assignment does not auto-start a rotation. Weekly/biweekly dates can be aligned to a configured weekday. The new deadline is based on the rotation execution date, so a late completion can shift subsequent weeks.

The next person follows the latest actual assignee in that duty's own order. Outstanding swap IOUs can substitute the debtor for the scheduled creditor. There is no global allocation that guarantees four different assignees or exactly one free person among five residents. Administrators can separately assign or manually rotate duties. No resident data was inspected to determine actual stored orders or dates. This change does not modify duty behavior.

## Verification

- `pnpm exec tsx --test tests/calendar-reminders.test.ts`: 20 passing cases, including summer/winter transitions, local midnight, year boundary, matching and exclusion of other waste types.
- `node tests/calendar-cron.test.mjs`: bundles the real route handlers with isolated database/push doubles using esbuild supplied by the existing tsx development dependency. Verifies only tomorrow's yellow-bag notifications, once-only same-day processing across both routes and missing/wrong cron authorization. No real DB or push calls.
- Real ShoppingPage component in an isolated browser fixture with synthetic session and intercepted API: Edge and WebKit at 390 px, name/note Enter, empty/repeat/IME, failed request preserving content, retry button, focus restoration. Both passed. No real shopping items created.
- TypeScript and production webpack build passed locally. Prisma client generated locally; no database commands applied.
- Full scoped ESLint reports two pre-existing react-hooks/set-state-in-effect violations in the shopping page's existing fetch/default-category effects. The unchanged HEAD version reproduces both. With that one baseline rule disabled for the check, the changed files pass. No lint configuration changed and no full-lint-green claim.

Deployment verification will be appended after the GitHub/Vercel result is known. Real delivery to residents' devices additionally requires enabled push subscriptions and the configured cron; no claim of a received device notification is made from local tests.
