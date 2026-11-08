import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import ExerciseTracker from "./src/components/ExerciseTracker";
import { useCameraAccess } from "./src/components/PoseCamera";
import { exercises } from "./src/components/repCounter";
import { INITIAL_STATS, rewardRep } from "./src/game/progression";

const green = "#bbfa75";
const muted = "#aabbb0";

export default function App() {
  return (
    <SafeAreaProvider>
      <TrainingLab />
    </SafeAreaProvider>
  );
}

function TrainingLab() {
  const [exercise, setExercise] = useState("curl");
  const [reps, setReps] = useState(0);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("IDLE");
  const [error, setError] = useState("");
  const { request } = useCameraAccess();
  const active = useRef(true);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "inactive") return;
      active.current = state === "active";
      if (!active.current) {
        setRunning(false);
        setStatus("PAUSED");
      }
    });
    return () => subscription.remove();
  }, []);

  const onRep = useCallback(({ exercise, reps: count }) => {
    // Update the rep counter
    setReps(count);

    // Award 10 XP to the corresponding stat
    setStats((current) => rewardRep(current, exercise));

    console.log("Exercise:", exercise);
    console.log("Reps:", count);
  }, []);

  const onError = useCallback((message) => {
    setRunning(false);
    setStatus("CAMERA ERROR");
    setError(message);
  }, []);
  const onStatus = useCallback(
    (phase) => setStatus(phase === "framing" ? "ADJUST FRAME" : "TRACKING"),
    []
  );

  async function start() {
    setPending(true);
    setError("");
    try {
      if (!(await request())) {
        onError(
          "Camera access is required. Allow access in your device settings and try again."
        );
        return;
      }
      if (!active.current) return;
      setReps(0);
      setStatus("STARTING");
      setRunning(true);
    } catch {
      onError("Unable to request camera access. Try again.");
    } finally {
      setPending(false);
    }
  }

  function select(id) {
    if (exercise === id) return;
    setExercise(id);
    setReps(0);
    setError("");
    setStatus("IDLE");
  }

  function end() {
    setRunning(false);
    setStatus("ENDED");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.main}>
          <Text style={styles.eyebrow}>HACKCAMP / POSE TEST</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Training Lab
          </Text>
          <Text style={styles.subhead}>
            Turn sideways and use your camera to count complete reps.
          </Text>

          <View style={styles.choices}>
            {Object.entries(exercises).map(([id, option]) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{
                  selected: id === exercise,
                  disabled: running || pending,
                }}
                disabled={running || pending}
                onPress={() => select(id)}
                style={[styles.choice, id === exercise && styles.selected]}
              >
                <Text style={styles.choiceName}>{option.label}</Text>
                <Text style={styles.caption}>
                  {id === "squat" ? "Speed · Experimental" : option.stat}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <View style={styles.metrics}>
              <View style={styles.repLine}>
                <Text accessibilityLiveRegion="polite" style={styles.count}>
                  {reps}
                </Text>
                <Text style={styles.caption}>REPS</Text>
              </View>
              <Text style={styles.eyebrow}>{status}</Text>
            </View>
            {running ? (
              <ExerciseTracker
                key={exercise}
                exercise={exercise}
                onRep={onRep}
                onError={onError}
                onStatus={onStatus}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.choiceName}>
                  {status === "ENDED" ? "Session complete" : "Camera is off"}
                </Text>
                <Text style={[styles.caption, styles.center]}>
                  {exercises[exercise].frame}
                </Text>
              </View>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={running ? end : start}
              style={({ pressed }) => [
                styles.button,
                (pressed || pending) && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.buttonLabel}>
                {running
                  ? "End session"
                  : pending
                  ? "Waiting for camera…"
                  : "Start camera"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.caption}>Camera frames stay on your device.</Text>
          <View style={styles.card}>
            <Text style={styles.choiceName}>Player Stats</Text>

            {Object.entries(stats).map(([name, stat]) => (
              <View key={name}>
                <Text style={styles.caption}>
                  {name.toUpperCase()} — Level {stat.level}
                </Text>
                <Text style={styles.caption}>
                  XP: {stat.xp} / {stat.level * 100}
                </Text>
              </View>
            ))}
          </View>

          {!running && (
            <Pressable
              style={styles.button}
              onPress={() => {
                onRep({
                  exercise,
                  reps: reps + 1,
                });
              }}
            >
              <Text style={styles.buttonLabel}>
                TEST: Complete 1 Rep (+10 XP)
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#0c1511", flex: 1 },
  scroll: { padding: 18, paddingBottom: 28 },
  main: { width: "100%", maxWidth: 600, alignSelf: "center", gap: 12 },
  eyebrow: {
    color: green,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  title: {
    color: "#f4faf4",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  subhead: { color: muted, fontSize: 16, lineHeight: 22 },
  choices: { flexDirection: "row", gap: 10, marginTop: 6 },
  choice: {
    flex: 1,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#34453a",
    borderRadius: 12,
  },
  selected: { backgroundColor: "#213321", borderColor: green },
  choiceName: { color: "#f4faf4", fontSize: 16, fontWeight: "700" },
  caption: { color: muted, fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: "#14221a", borderRadius: 18, padding: 14, gap: 10 },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  repLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  count: {
    color: "#f4faf4",
    fontSize: 42,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  placeholder: {
    backgroundColor: "#0b130e",
    borderRadius: 14,
    minHeight: 155,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 6,
  },
  center: { textAlign: "center" },
  error: { color: "#ffb9ae", fontSize: 14 },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: green,
    borderRadius: 10,
  },
  buttonLabel: { color: "#14221a", fontSize: 16, fontWeight: "800" },
});
