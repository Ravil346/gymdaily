import { db } from '../db/schema';
import type { ProgramDay } from '../db/schema';

export async function getNextDay(programId: number): Promise<ProgramDay | null> {
  const days = await db.programDays
    .where('programId')
    .equals(programId)
    .sortBy('order');

  if (days.length === 0) return null;

  const lastWorkout = await db.workouts
    .where('programId')
    .equals(programId)
    .reverse()
    .first();

  if (!lastWorkout) return days[0];

  const lastDayIndex = days.findIndex(d => d.id === lastWorkout.dayId);
  const nextIndex = (lastDayIndex + 1) % days.length;
  return days[nextIndex];
}

/** Запускает тренировку: создаёт Workout и WorkoutExercise для каждого упражнения дня */
export async function startWorkout(programId: number, dayId: number, date?: number): Promise<number> {
  const exercises = await db.programExercises
    .where('dayId')
    .equals(dayId)
    .sortBy('order');

  const workoutId = await db.workouts.add({
    programId,
    dayId,
    date: date ?? Date.now(),
  });

  if (exercises.length > 0) {
    await db.workoutExercises.bulkAdd(
      exercises.map((ex, i) => ({
        workoutId,
        programExerciseId: ex.id!,
        name: ex.name,
        order: i,
        comment: ex.comment,
      }))
    );
  }

  return workoutId;
}
