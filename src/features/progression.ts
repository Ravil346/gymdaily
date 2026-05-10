import { db } from '../db/schema';

export interface ProgressionResult {
  weight: number;
  willProgress: boolean;
}

export async function getRecommendedWeight(programExerciseId: number): Promise<ProgressionResult> {
  const tpl = await db.programExercises.get(programExerciseId);
  if (!tpl) return { weight: 0, willProgress: false };

  // Последняя WorkoutExercise для этого шаблона
  const allWE = await db.workoutExercises
    .where('programExerciseId')
    .equals(programExerciseId)
    .toArray();

  if (allWE.length === 0) return { weight: tpl.weight, willProgress: false };

  // Берём последнюю по workoutId (workoutId растёт по времени)
  const lastWE = allWE.reduce((prev, cur) => cur.workoutId > prev.workoutId ? cur : prev);

  const sets = await db.workoutSets
    .where('workoutExerciseId')
    .equals(lastWE.id!)
    .sortBy('setNumber');

  const lastWeight = sets[0]?.weight ?? tpl.weight;

  // Прогрессия: все запланированные подходы сделаны с нужным числом повторов
  const allDone =
    sets.length >= tpl.sets &&
    sets.slice(0, tpl.sets).every(s => s.reps >= tpl.reps);

  if (allDone && tpl.progressionStep > 0) {
    return { weight: lastWeight + tpl.progressionStep, willProgress: true };
  }

  return { weight: lastWeight, willProgress: false };
}
