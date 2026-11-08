import { useCallback, useState } from "react";
import ExerciseTracker from "./ExerciseTracker";
import {
  INITIAL_STATS,
  rewardRep
} from "./game/progression";

export default function TrainingScreen() {
  const [stats, setStats] = useState(INITIAL_STATS);

  const handleRep = useCallback(({ exercise, reps }) => {
    setStats(current => rewardRep(current, exercise));
    console.log("Completed rep:", exercise, reps);
  }, []);

  return (
    <ExerciseTracker
      exercise="curl"
      onRep={handleRep}
    />
  );
}