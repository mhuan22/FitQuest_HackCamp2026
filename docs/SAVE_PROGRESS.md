# User progress saves

## What persists

Supabase Auth owns account credentials and sessions. `profiles` owns the username; `player_progress` owns each user's game save:

- Versioned XP for Strength, Agility, Defense and Vitality.
- Training streak and last completed training date.
- Earned boss rewards, from which boss progression is restored.
- Ultimate stacks (one starter stack, +1 per three consecutive training days, maximum three).
- Sound preference.
- Server revision, mutation identity and update timestamp for reliable writes.

Stat levels, balanced character level, appearance and boss eligibility are recalculated from saved XP and rewards. Ultimate is available at character level one; each use consumes one saved stack and does not require battle charges.

XP saves as it is earned, including partial training sessions. A completed session also saves the daily streak. Active battles, temporary HP, camera data and the unfinished session interface are not resumed after refresh. Boss clear rewards are persisted.

## Fix for rejected cloud saves

The first database migration requires an obsolete `skin` field and rejects version, streak and training date. The game now writes version 2, so that validator rejects every changed save.

Apply `supabase/migrations/202611080002_progress_v2.sql` to the existing project, then `supabase/migrations/202611080003_ultimate_stacks.sql` for persisted Ultimate stacks. It replaces the validator and updates the default for new players; it does not reset existing progress, revisions, ownership policies or retry identities. Existing legacy XP is converted once on loading and written back in the current format on the next save.

Preferred deployment is through the project's Supabase CLI migration workflow, after reviewing the linked project and pending migration list. If the first migration was applied manually, reconcile migration history before attempting `db push`, so it does not recreate existing tables.

For a dashboard-managed development project, the second migration can also be run in the SQL editor. Run only the new migration against an initialized project, not the first table-creation migration again. Reconcile the migration history before adopting CLI deployment later.

This workspace has a publishable key, which cannot update SQL functions. No hosted migration was applied by this implementation. A subsequent read-only check of the hosted `valid_player_progress` function confirmed it now accepts the complete version-2 save format.

## Reliability and recovery

`useProgress` serializes uploads and uses revision comparison plus a UUID for idempotent retries. It keeps an account-scoped browser recovery copy of both the exact in-flight request and any newer changes until the server confirms them. Refreshing retries the original mutation, then uploads newer progress. Another account never reads that recovery copy, and it never replaces the guest/demo save.

Network failures display a retry panel and are retried on reconnect. A conflict requires choosing to reload the newer cloud save; that action explicitly discards this device's unsaved recovery copy. Save errors stop further training progression until resolved. Failed cloud loads do not fall back to an empty default save.

The status indicator distinguishes account saves from guest/demo saves. Guest/demo progress stays in browser storage and does not follow the user across devices. Sign in before testing cloud persistence. Demo shortcuts are disabled for signed-in saves.

## Verification

- `npm test`: authentication, save/load contracts, queue ordering, failures, recovery after refresh, user isolation and conflicts.
- `npm run test:db:embedded`: applies both SQL migrations to disposable in-memory PostgreSQL, reproduces the old rejection, verifies the fix and legacy-data preservation, and checks row ownership, complete save/load, retries and stale revisions. Never contacts the hosted database.
- `node --test tests/*.test.mjs`: progression, boss access and animation checks.
- `npm run typecheck` and `npm run build`.

After deployment, sign in, finish a few reps, wait for **Progress saved to account**, and refresh. Check XP, streak after completing a session, rewards and sound preference. Guest/demo tests do not verify hosted saves.
