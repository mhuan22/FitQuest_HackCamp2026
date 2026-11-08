# Game audio

## Soundtrack

| Scene | Track |
| --- | --- |
| Base | Homestead |
| Gym, training | On and Up |
| Slime, Owl | Encounter |
| Golem, Shellback | Darkwood |

The four full stereo loops are served locally as MP3 with gapless encoding metadata. Music crossfades over 600ms between scenes, drops to 55% of its usual volume during training and 18% during Ultimate, and fades out for battle results. Separate NES jingles mark completion, level-up, victory and defeat.

Source credits and original licenses: `public/audio/CREDITS.md` and `public/audio/licenses/`.

## Effects and timing

- Menu clicks and successful reps have low-volume feedback and short repeat cooldowns.
- Normal strikes and boss hits/guards play from the same timers that apply damage.
- Ultimate charges at 0, 250 and 500ms with increasing pitch, releases at 900ms and layers heavy/metallic impact at 1200ms.
- No more than six effect voices overlap.

## Lifecycle

`GameAudio` owns all playback; `useGameAudio` follows scene, exercise, Ultimate, pause, visibility and saved mute state. The mute control is available in every gameplay scene and saves through the existing progress flow, requiring no schema change.

Playback is attempted after entering the game. If browser autoplay policy refuses it, the next pointer or keyboard gesture retries it. Failed playback does not break gameplay. Muting, pausing training, hiding the tab, save errors and logout stop audio; old effects are not replayed when music resumes. Unmounting cleans up players and fade timers.

The separate listening comparison remains at `/audio-audition/index.html`.

## Checks

Audio-engine tests cover mute, scene crossfades, repeated renders, music ducking, refused autoplay, hidden tabs, voice limits, result jingles and StrictMode cleanup. Real game UI tests cover saved mute, its availability in battle, workout feedback and Ultimate impact timing.
