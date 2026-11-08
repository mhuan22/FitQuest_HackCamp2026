import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PoseCamera from './PoseCamera';
import { createRepCounter, exercises, staleMs } from './repCounter';
import { createEnduranceTracker } from './enduranceTracker';

const initial = { reps: 0, phase: 'loading', angle: null };

export default function ExerciseTracker({ exercise, onRep, onDuration, onError, onStatus }) {
  const option = exercises[exercise];
  const counter = useMemo(
    () => option.timed ? createEnduranceTracker() : createRepCounter(exercise),
    [exercise, option],
  );
  const timeout = useRef(null);
  const duration = useRef(0);
  const [result, setResult] = useState(initial);

  const reset = useCallback(() => {
    clearTimeout(timeout.current);
    counter.loseTracking();
    setResult(previous => ({ ...previous, phase: 'framing', angle: null }));
  }, [counter]);

  useEffect(() => () => clearTimeout(timeout.current), [counter]);

  const onFrame = useCallback((points, width, height, time) => {
    clearTimeout(timeout.current);
    const next = counter.update(points, width, height, time);
    setResult(next);
    onStatus?.(next.phase);
    if (option.timed && next.durationMs !== duration.current) {
      duration.current = next.durationMs;
      onDuration?.({ exercise, durationMs: next.durationMs });
    }
    if (next.counted) onRep?.({ exercise, reps: next.reps });
    timeout.current = setTimeout(() => {
      reset();
      onStatus?.('framing');
    }, staleMs);
  }, [counter, exercise, onRep, onDuration, onStatus, option, reset]);

  const angleLabel = option.showSlope ? 'TORSO ANGLE' : 'JOINT ANGLE';

  return (
    <>
      <View style={styles.preview}>
        <PoseCamera exercise={exercise} onFrame={onFrame} onError={onError} onReset={reset} />
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>{result.angle == null ? 'POSE TRACKER' : result.angle + '° ' + angleLabel}</Text>
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.feedback}>
        {result.phase === 'loading' ? 'Opening camera and loading pose tracking…' : option[result.phase]}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  preview: { height: 300, overflow: 'hidden', backgroundColor: '#080e0a', borderRadius: 16 },
  badge: { position: 'absolute', bottom: 12, left: 12, backgroundColor: '#122219', padding: 8, borderRadius: 6 },
  badgeText: { color: '#bbfa75', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  feedback: { color: '#e8f5eb', fontSize: 16, minHeight: 44, paddingTop: 12 },
});
