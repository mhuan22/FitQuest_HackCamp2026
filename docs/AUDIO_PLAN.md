# Pixel-art audio research

Implementation is now complete: the selected full music loops and effects are wired into gameplay and use the saved sound preference. See [AUDIO_IMPLEMENTATION.md](AUDIO_IMPLEMENTATION.md) for the final scene mapping, playback behavior, and tests. The research below records the candidate sources.

## Suggested sound direction

Use warm 8-bit/16-bit-style chiptune loops with restrained sound effects. Keep the base calm, the gym rhythmic, and battles more urgent. Reserve the largest sound for Dawnbreaker's impact so routine interactions remain comfortable.

| Event or scene | Proposed audio |
| --- | --- |
| Base | Gentle village/adventure loop |
| Gym | Upbeat training loop |
| Slime | Playful battle loop |
| Golem | Lower, heavier battle arrangement |
| Owl | Bright, icy arpeggios |
| Shellback | Tense final-boss arrangement |
| UI | Quiet confirm/back ticks; avoid hover sounds on every mouse movement |
| Successful rep | Short bright confirmation, with a cooldown |
| Level-up / session completion | Brief rising reward jingle |
| Attack / guard / damage | Short slash, shield and impact effects aligned with strike timing |
| Ultimate | Charge sound at wind-up; slash at 900ms; strongest impact at 1200ms |
| Victory / defeat | Short contrasting fanfares |

These are proposed mappings, not claims that specific downloaded files have been auditioned.

## Candidate assets and licenses

- **dancramp — 8 Bit Retro RPG Music Asset Pack CC0:** 13 tracks, around 12 minutes of loop content, WAV format, NES-style synthesis. A useful starting point for a consistent background soundtrack. https://dancramp.itch.io/8-bit-retro-rpg-music-asset-pack
- **Kenney — Interface Sounds:** 100 interface sounds, CC0; use selected quiet clicks and confirmations. https://kenney.nl/assets/interface-sounds
- **Kenney — Impact Sounds:** 130 effects, CC0; possible hits, guard and heavy impact layers. https://kenney.nl/assets/impact-sounds
- **Kenney — Music Jingles:** 85 jingles, CC0; candidates for level-up and results. https://kenney.nl/assets/music-jingles
- **Kenney — Digital Audio:** 60 effects, CC0, tagged space/laser; consider only a few electronic layers for Ultimate, after checking that they fit the fantasy style. https://kenney.nl/assets/digital-audio

The listed pages identify these packs as CC0. Retain the downloaded license files and source credits with any assets selected for the repository. The packs have now been downloaded and checked. An audition player at `/audio-audition/index.html` contains 13 volume-adjusted music excerpts and 20 selected effects/jingles with original license files. The assistant cannot directly hear playback in this workspace, so role assignments remain provisional pending listening.

## Integration approach

1. Download and audition a small selection; keep a consistent loudness and musical palette.
2. Store selected tracks locally with their license/credits. Use browser-friendly compressed loops for music and short clips for effects.
3. Add one audio manager shared by scenes, with separate music/effect gain and the existing saved master mute preference.
4. Start/resume audio from a user gesture, and handle refused playback without breaking the game. Browser policy reference: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
5. Crossfade scene music; avoid restarting a track on each React render. Pause playback when the tab is hidden.
6. Trigger effects from gameplay events and existing impact timers, not repeatedly from renders. Stop pending effects on scene changes/logout/reset.
7. Lower background music during training feedback and the Ultimate cinematic. Keep effects bounded so rapid reps and clicks do not build up excessive volume.
8. Test mute persistence, rejected autoplay, audio load errors, scene transitions, repeated battle actions, and cleanup.

The standalone audition player and its preview assets are available in `public/audio-audition/`. The selected full loops and effects have now been integrated into gameplay; the comparison page remains available.
