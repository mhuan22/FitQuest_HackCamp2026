# FitQuest

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

- Curls, squats, and sit-ups count completed movements and earn 10 XP per rep when you reach the session target.
- The treadmill measures sustained movement and earns 10 Vitality XP per 30 active seconds when you reach the session target.
- Pause or finish the session to stop the camera. Resuming keeps the progress already counted.

The local development server offers simulation controls for testing the workout flow. Guest saves are tied to the browser and site address.

## Source layout

- `src/vision` contains MediaPipe camera setup, rep counting, and active-time tracking.
- `src/training` defines gym stations and workout settings.
- `src/game` contains player progression and save data.
- `src/App.tsx` renders the game and connects workouts to progression and combat.
- `.figma` contains Figma Make configuration for the original export.
