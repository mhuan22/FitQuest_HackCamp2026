# Training Lab

A React Native camera test screen for the HackCamp Fitness RPG. MediaPipe estimates one person's pose on the device. The same rep counter runs on mobile and in the browser.

## Try it in a browser

From this folder, run:

```sh
npm ci
npm run web
```

Open the localhost URL printed by Expo and select **Start camera**. Allow camera access when prompted. The browser downloads the MediaPipe model and WebAssembly runtime on startup, so it needs an internet connection. Camera frames stay in the browser.

## Try it on a phone

Use a physical device and build with `npm run ios` (Xcode and iOS signing) or `npm run android` (Android SDK and a connected device). The MediaPipe native module requires a custom build. The Expo Go app cannot load it.

## Check the rep counter

1. Select **Bicep curl** and face sideways to the camera. Keep the near shoulder, elbow, and wrist visible.
2. Begin with your arm extended. Try a partial curl and check that the count stays at zero.
3. Curl to a right angle or tighter, then extend the arm again. Check that the count increases by one. Use a comfortable range and stop if you feel pain.
4. Move out of frame midway through a curl. Check that you need to start again from the extended position to earn the next rep.
5. Select **End session**. The preview stops and the final rep count stays on screen.
6. For the experimental **Squat**, keep your hip, knee, and ankle in view. Start upright, lower until your thigh is near level, then stand tall.

Curl scoring uses a projected elbow angle of at least 150°, then at most 90°, then at least 150° again. Each threshold must hold for about 150 ms after smoothing. Low-confidence joints or an interruption clear the current phase while preserving completed reps.

## Reuse it in the game

Mount `ExerciseTracker` after obtaining camera permission and unmount it when the workout ends or the screen loses focus. Pass `exercise="curl"` or `exercise="squat"` and a stable `onRep={({ exercise, reps }) => …}` callback. The callback runs once per completed rep and reports the session total. Use `onError` to stop the workout and offer a retry. See `App.js` for the permission and session flow.
