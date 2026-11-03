# Account consolidation

Status on 2026-11-03: explicitly confirmed by the user and successfully executed in production through the owner SQL editor.

The transactional script is `scripts/merge-user.sql`. Supply the source, target and WG using transaction-local settings. Production identifiers and personal records must not be committed. Protected before-images remain in the private `wg_hosting` schema, not in local exports or application logs.

Verified with synthetic PostgreSQL/PGlite fixtures:
- conflicting financial participation aborts and rolls back;
- foreign-key and non-FK references move to the target;
- game result counts and point totals are preserved;
- individual expense shares and participant order survive;
- target profile and password hash remain unchanged;
- old reset tokens are revoked and the source account is removed;
- protected backup tables have RLS enabled.

The prepared authentication change rejects existing JWTs for deleted users. Its targeted test, TypeScript check (`--incremental false`) and ESLint check passed. It has not been deployed; a successful deployment build and live postflight remain required.

Production postflight confirmed that the source account is absent, the retained target exists, and all 18 game results with 3177 raw points are assigned to the target. All FK/non-FK reference checks, table row-count invariants and exact target identity preservation passed inside the transaction. One old password-reset token was revoked. The private backup contains 153 before-images, and the runtime application role cannot read it. The existing weekly plan still includes the retained target. No resident data or credentials were exported locally. The authentication deployment is pending.
