import type { CSSProperties } from "react";
import { ULTIMATE } from "./game/ultimate";

export function UltimateEffect() {
  return (
    <div className="ultimate-fx" aria-hidden="true" style={{
      "--ult-windup": `${ULTIMATE.windup}ms`,
      "--ult-impact": `${ULTIMATE.impact}ms`,
      "--ult-duration": `${ULTIMATE.duration}ms`,
    } as CSSProperties}>
      <div className="ultimate-shade" />
      <div className="ultimate-bar ultimate-bar-top" />
      <div className="ultimate-bar ultimate-bar-bottom" />
      <div className="ultimate-rune"><i /><i /><i /></div>
      <div className="ultimate-pillar" />
      <div className="ultimate-title"><small>ALL YOUR POWER. ONE STRIKE.</small><strong>DAWNBREAKER</strong><span>ROOK · LIMIT UNLEASHED</span></div>
      <div className="ultimate-speedlines" />
      <svg className="ultimate-blade" viewBox="0 0 1000 500" preserveAspectRatio="none">
        <defs><linearGradient id="ultimate-gold"><stop stopColor="#ff8b24" stopOpacity="0" /><stop offset=".55" stopColor="#ffc75a" /><stop offset="1" stopColor="#fffbe6" /></linearGradient></defs>
        <path d="M 110 460 Q 470 310 895 35 Q 690 300 110 460 Z" fill="url(#ultimate-gold)" />
        <path d="M 190 430 Q 560 260 890 40" fill="none" stroke="#fffde5" strokeWidth="8" />
        <path d="M 280 470 Q 650 340 940 95" fill="none" stroke="#ffba48" strokeWidth="3" />
      </svg>
      <div className="ultimate-impact"><i /><i /><i /></div>
      <div className="ultimate-sparks">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{
        "--spark-angle": `${i * 137.5}deg`, "--spark-distance": `${90 + i % 5 * 35}px`,
        "--spark-delay": `${i % 4 * 18}ms`,
      } as CSSProperties} />)}</div>
      <div className="ultimate-callout"><small>LIMIT BREAK</small><strong>DAWNBREAKER!</strong></div>
    </div>
  );
}
