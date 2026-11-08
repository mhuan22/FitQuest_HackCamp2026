import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PoseCamera from './PoseCamera';
import { createRepCounter, exercises, staleMs } from './repCounter';

const initial = { reps: 0, phase: 'loading', angle: null };

export default function ExerciseTracker({ exercise, onRep, onError, onStatus }) {
  const counter = useMemo(() => createRepCounter(exercise), [exercise]);
  const timeout = useRef(null);
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
    if (next.counted) onRep?.({ exercise, reps: next.reps });
    timeout.current = setTimeout(() => {
      reset();
      onStatus?.('framing');
    }, staleMs);
  }, [counter, exercise, onRep, onStatus, reset]);

  return (
    <>
      <View style={styles.preview}>
        <PoseCamera exercise={exercise} onFrame={onFrame} onError={onError} onReset={reset} />
        <View pointerEvents="none" style={styles.badge}>
          <Text style={styles.badgeText}>{result.angle === null ? 'POSE TRACKER' : result.angle + '° JOINT ANGLE'}</Text>
        </View>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.feedback}>
        {result.phase === 'loading' ? 'Opening camera and loading pose tracking…' : exercises[exercise][result.phase]}
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
