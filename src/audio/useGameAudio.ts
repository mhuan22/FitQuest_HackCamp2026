import { useEffect, useState } from "react";
import { GameAudio, type MusicTrack } from "./GameAudio";

export function useGameAudio(enabled: boolean, track: MusicTrack | null, duck: number, suspended: boolean) {
  const [audio] = useState(() => new GameAudio());
  useEffect(() => {
    audio.configure({ enabled, track, duck, suspended });
  }, [audio, enabled, track, duck, suspended]);
  useEffect(() => {
    const unlock = () => audio.unlock();
    const visibility = () => audio.setHidden(document.hidden);
    const click = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.("button");
      if (button && !button.disabled && !button.classList.contains("game-audio-toggle")) audio.play("click");
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    document.addEventListener("click", click, true);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    audio.unlock(); // If autoplay is refused, the next user gesture retries it.
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose();
    };
  }, [audio]);
  return audio;
}
