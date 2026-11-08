> Historical investigation: the findings below describe the original integration gaps. Authentication is now connected, and the current save-format migration, durable recovery queue, and save indicator are implemented. See [SAVE_PROGRESS.md](SAVE_PROGRESS.md) for current deployment steps and behavior. A subsequent read-only check confirmed that the hosted validator accepts current version-2 saves.

# User persistence investigation

## Current state

The local frontend is configured to connect to a hosted Supabase project, rather than a local Postgres instance. The environment file contains a Supabase URL and publishable key. Credentials were not copied into this report.

The running entrypoint (`src/main.tsx`) renders `App` directly. `App` loads and writes browser localStorage. Its login/signup UI currently displays a placeholder message, so game progress is not associated with a Supabase user.

The repository already contains an account implementation, but it is not integrated:

- `src/AccountApp.tsx` restores an authenticated session and loads a user's cloud save before rendering the game.
- `src/game/cloudSave.ts` reads `profiles` and `player_progress`, and calls `save_player_progress` with a revision and mutation UUID.
- `src/game/useProgress.ts` serializes writes, retries uncertain failures using the same UUID, and blocks automatic writes on conflicts.
- `supabase/migrations/202611080001_accounts_and_progress.sql` defines account initialization, per-user read policies, validated writes, and revision checking.

These are source-code findings. The deployed database schema and policies have not been inspected, and no remote data was changed.

## Data to persist

| Data | Storage | Purpose |
| --- | --- | --- |
| Account ID, email, credentials | Supabase Auth | Account ownership and authentication; do not duplicate passwords in game tables |
| Username | `profiles`, keyed by Auth user ID | User identity in the game |
| Strength, agility, defense, vitality XP | `player_progress.data` | Restore all training and combat progression |
| Streak and last completed training date | `player_progress.data` | Restore consecutive training days |
| Boss rewards/clears | `player_progress.data` | Restore boss access and earned rewards |
| Sound preference and save version | `player_progress.data` | Restore settings and migrate saves |
| Revision, mutation ID, update timestamp | `player_progress` columns | Prevent stale overwrites and make retries safe |

Character level, individual stat levels, character appearance and boss access are derived from XP/rewards. Ultimate stacks are now persisted separately; see ULTIMATE.md. Recompute them rather than maintaining duplicate persisted values.

If training history is needed, introduce a separate `workout_sessions` table containing user ID, unique session ID, exercise, completed reps or active seconds, XP earned, completion status, and timestamps. This is an additional feature: the existing code only stores cumulative progress. An RPC should apply session rewards and insert the session atomically, with the unique session ID preventing duplicate rewards.

Do not persist camera frames or pose landmarks for progression. Current workout processing runs in the browser.

## Integration gaps to resolve

1. Add the missing Supabase client dependency. Existing account tests also require their missing Vitest/jsdom tooling.
2. Adapt `App` to accept the account ID, username, initial cloud save/revision, logout, and reload callbacks expected by `AccountApp`.
3. Render `AccountApp` from `main.tsx` and connect `AuthScreen` to real authentication. Username login requires the existing Edge Function to be deployed; signup needs an email for Supabase Auth.
4. Adapt `useProgress` to the current `loadSave(storageKey)` signature; it currently passes an obsolete numeric model count. Normalize incoming cloud data using the current progression model.
5. Add a new migration to reconcile the JSON validator/default with the current SaveData: version, four XP values, streak, lastTrainingDate, sound, rewards. The old validator requires `skin`, rejects version/streak/date, and cannot accept current saves. Preserve existing rows during migration.
6. Replace App's localStorage effect with the persistence hook. Keep loading, save failures, retries, and conflicts visible. Do not replace a failed cloud load with a default empty save.
7. Scope guest and demo localStorage separately. Disable demo shortcuts for authenticated cloud saves; current development mode automatically enables demos. Never silently upload an arbitrary guest/demo save to an account.
8. Wire save errors/conflicts to game controls and warn before leaving with unconfirmed progress. Keep account changes isolated by remounting for each user ID.
9. Update existing account/save tests to the current progression model, then exercise login, refresh, retry, conflict, logout, and switching accounts.
10. Apply migrations and verify policies against the configured database, followed by a signed-in save/reload check. No deployed schema or account changes were performed in this investigation.

## Validation observed

A TypeScript check currently fails in the existing account files because the Supabase/Vitest dependencies are missing, the account wrapper passes unsupported App props, the persistence hook uses the old loadSave signature, and tests use the removed `skin` field. These must be resolved before enabling this integration.

The SQL source includes row-level security and an authenticated save RPC, which is the right foundation for isolating users. It does not make client-supplied XP authoritative or resistant to manipulation. If competitive rankings or trusted rewards are introduced, use server-validated progression events rather than accepting an arbitrary replacement XP snapshot.

Reference: https://supabase.com/docs/guides/auth/managing-user-data
