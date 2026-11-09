# Fit Quest

FitQuest is a browser fitness RPG. Train at the gym to improve your stats, then challenge bosses at the arena gate.

## Run locally

Use Node.js 22 and run:

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite and choose **Explore as a guest**. Use `npm run build` for a production build or `npm run preview` to preview that build.

## Train with the camera

Enter the gym, choose a station and a target, then select **Enable Camera**. Camera access requires localhost or HTTPS. The browser downloads the MediaPipe model and runtime when tracking starts. Camera frames are processed in the browser.

- Curls, squats, and sit-ups count completed movements and earn 10 XP per rep as you train.
- The treadmill measures sustained movement and earns 10 Vitality XP per 30 active seconds as you train.
- Pause or finish the session to stop the camera. Resuming keeps the progress already counted.

The local development server offers simulation controls for testing the workout flow. Guest saves are tied to the browser and site address.

## Set up accounts and cloud saves

1. In your Supabase project, enable Email/password signup and **Confirm email**.
2. Under Authentication → URL Configuration, set the Site URL to `http://localhost:8443` and add `http://localhost:8443/**` to Redirect URLs. Use your actual Vite port. For production, set the Site URL to the deployed HTTPS origin and allow that origin and its `/?reset=1` recovery URL too.
3. Put the following in `.env.local` (or your existing `.env`). These are browser connection details; never put a secret/service-role key here:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

4. In Supabase **SQL Editor**, open a new query, paste the entire contents of `supabase/migrations/202611080001_accounts_and_progress.sql`, and run it **once**. It creates the profile/progress tables, signup trigger, ownership policies, save function, and private login rate limiter. This migration targets a new project with no existing Auth users; create test accounts through the app after applying it, not through the dashboard's Add User form.
5. Deploy the username login function from this directory:

   ```sh
   npx supabase login
   npx supabase functions deploy username-login --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   The project reference is the identifier in your Supabase project's URL. The function intentionally accepts unauthenticated requests because it creates the login session. It validates credentials with Supabase Auth, throttles attempts in Postgres, and never returns account email addresses. Hosted Edge Functions provide `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` automatically; these stay on the server. If using the Dashboard editor instead, create a function named `username-login`, replace its source with `supabase/functions/username-login/index.ts`, disable **Verify JWT** for this function, and deploy it.
6. Restart `npm run dev`. Sign up with a unique username, real email, and password, confirm the email, and log in using the username/password. Usernames are case-insensitive. Forgot password sends an email link to a screen for choosing a new password.

Alternatively, apply the migration with the CLI instead of step 4: run `npx supabase login`, `npx supabase link --project-ref YOUR_PROJECT_REF`, then `npx supabase db push`. Do not both paste the SQL manually and then push the same migration without first marking it applied in the CLI migration history.

Accounts persist XP, character, sound preference, and boss unlocks across browsers. Guests remain local, and existing guest saves are never imported automatically. A new account starts with default progress. The Google placeholder has been removed; Google authentication and workout history are not included.

The **Log out** button appears with the controls at the top right of the base and gym. Saving happens automatically; logout is briefly disabled while a save is pending. On a network error, progress stays in memory and play pauses behind a **Retry Save** dialog. Retrying is safe even if the original response was lost. A conflict from another tab/device requires explicitly reloading its newer cloud save; doing so discards this tab's unsaved changes. This version does not queue saves across page closes or offline restarts. Cloud saves validate the shape of progress but trust the client-reported XP and boss wins; they do not provide anti-cheat verification.

## Verify accounts

- Create an account, verify its email, log in with a differently capitalized username, and refresh. It should restore the same account and progress.
- Finish a 5-rep simulated curl workout: Strength gains 50 XP. End a second workout early: no additional XP. Switch character and sound, log out, and log in in another browser: these changes should persist.
- Use a second account to check it starts at zero and cannot read the first account's profile/progress through the browser Supabase client. Return to guest mode and confirm its previous save is separate.
- Test wrong passwords, duplicate usernames, reset email links, and expired recovery links. No login response should contain an email address.
- Disconnect after the app has loaded, earn a reward, then reconnect and retry. It should save once. In two tabs, change the same account in each: the stale tab must show a conflict rather than overwrite the newer save.
- Run `npm test`, `npm run typecheck`, and `npm run build`. Frontend tests mock Supabase to cover auth forms, recovery, session restoration, account switching, and serialized/retryable saves. Edge Function tests run the production login handler against fake server clients, without contacting your project.
- With PostgreSQL binaries on PATH, run `npm run test:db`. On Windows you can instead set `$env:PG_BIN='C:\Program Files\PostgreSQL\17\bin'` first. This script starts and stops a disposable local database and tests the production SQL, including row ownership, signup initialization, invalid progress, retry deduplication, revision conflicts, and login throttling. It never connects to your hosted project.

## Source layout

- `src/vision` contains MediaPipe camera setup, rep counting, and active-time tracking.
- `src/training` defines gym stations and workout settings.
- `src/game` contains player progression and save data.
- `src/App.tsx` renders the game and connects workouts to progression and combat.
- `.figma` contains Figma Make configuration for the original export.

## Verify the application

Run `npm run check` for TypeScript, account and game integration tests, progression/animation/workout-tracking tests, disposable PostgreSQL migration checks, and the production build. The database tests do not connect to hosted Supabase.

See [user progress saves](docs/SAVE_PROGRESS.md) for persistence behavior and [verification results](docs/VERIFICATION.md) for the latest review and manual checks.

## Retired reporting integration

The Guild report and workout uploads have been removed. Authentication and player progress saves do not require Databricks or the former report Edge Function. Migration `202611080004_workout_sessions.sql` is retained as historical schema for compatibility; its objects are unused by the app. Existing hosted reporting data is left intact.
