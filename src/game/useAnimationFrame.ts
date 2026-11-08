import { useEffect, useState } from "react";

export function useAnimationFrame(active: boolean, interval: number, frameCount = 2, loop = true, clip = "") {
  const identity = `${active}:${interval}:${frameCount}:${loop}:${clip}`;
  const [state, setState] = useState({ identity, frame: 0 });
  useEffect(() => {
    setState({ identity, frame: 0 });
    if (!active) return;
    const start = performance.now();
    let request = 0;
    const tick = (now: number) => {
      const elapsedFrame = Math.floor((now - start) / interval);
      const frame = loop ? elapsedFrame % frameCount : Math.min(elapsedFrame, frameCount - 1);
      setState(current => current.identity === identity && current.frame === frame ? current : { identity, frame });
      if (loop || elapsedFrame < frameCount - 1) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [active, interval, frameCount, loop, identity]);
  // A new clip must render frame zero immediately, before its effect runs.
  return state.identity === identity ? state.frame : 0;
}

