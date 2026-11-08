# Verification — 2026-11-08

## Automated checks

`npm run check` runs:

- TypeScript for the complete app.
- 51 Vitest tests: authentication, account restoration and isolation, cloud-save contracts, retries, recovery after refresh, conflict handling, and real game UI flows.
- 23 Node tests: balanced leveling, boss requirements, demo shortcuts, Ultimate timing/damage, animation transitions, full exercise repetitions and sustained treadmill activity.
- Embedded PostgreSQL checks: reproduce the old save rejection, apply the new migration without changing existing progress, validate the current save format, enforce row ownership, round-trip persistent fields, and reject stale revisions.
- Vite production build.

All checks pass. The production build reports a non-blocking bundle-size warning.

The game integration tests render the real game, exercise movement into the gym, start training, feed simulated camera progress into the real progression flow, check cloud-save calls, remount demo saves, inspect boss locks and activate Ultimate. They do not replace a visual browser or physical camera check.

## Live read-only checks

The running preview returned 200 for the app entrypoint, game, auth and cloud-save modules, and all six background images. Background responses contain valid PNG data. All source PNGs were checked for valid signatures; no unresolved LFS pointers remain in them.

Hosted Supabase checks confirmed:

- Auth settings respond successfully; email confirmation is disabled.
- The username-login Edge Function responds to OPTIONS requests.
- The hosted immutable `valid_player_progress` function accepts synthetic version-2 data with stat XP, streak, training date, rewards and preferences. This confirms the current save format is accepted by the deployed validator.

These requests did not create accounts, send email, read personal records, or modify user data.

## Issues corrected during review

1. Signup without email confirmation now reports immediate account creation rather than instructing the user to check email.
2. Email-send rate limiting gets a clear message instead of an unrelated connection error.
3. The demo clock survives refresh, preserving the meaning of simulated consecutive training days. Older future-dated demo saves can recover their last training day.
4. Boss victory screens respect character-level gates instead of incorrectly announcing an inaccessible next boss as unlocked.
5. XP awarding uses the shared training constants rather than duplicate numeric values.

## Manual verification still needed

- Sign in as a real user, earn XP, wait for the account-saved indicator, refresh, and verify XP, streak, rewards and sound settings. No account credentials were available for this review, so a live authenticated save/read round-trip was not performed.
- Use a physical camera to verify permission prompts, pose-model downloads, tracking quality under actual lighting, pause/resume, and camera disconnect handling. Tracking logic was exercised with synthetic poses, not a physical camera.
- Visually inspect the running UI and cinematic on desktop and mobile. No automated browser screenshot pass was available in this review.
