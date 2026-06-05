import { db } from './schema';
import type { Program, ProgramDay, ProgramExercise, Workout, WorkoutExercise, WorkoutSet } from './schema';

// ── Программы ─────────────────────────────────────────────

export async function getPrograms(): Promise<Program[]> {
  return db.programs.toArray();
}

export async function getFavoriteProgram(): Promise<Program | undefined> {
  return db.programs.filter(p => p.isFavorite === true).first();
}

export async function createProgram(name: string): Promise<number> {
  return db.programs.add({ name, isFavorite: false, createdAt: Date.now() });
}

export async function updateProgram(id: number, data: Partial<Program>): Promise<void> {
  await db.programs.update(id, data);
}

export async function deleteProgram(id: number): Promise<void> {
  const days = await db.programDays.where('programId').equals(id).toArray();
  for (const day of days) {
    if (day.id !== undefined) {
      await db.programExercises.where('dayId').equals(day.id).delete();
    }
  }
  await db.programDays.where('programId').equals(id).delete();
  await db.programs.delete(id);
}

export async function setFavoriteProgram(id: number): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    await db.programs.filter(p => p.isFavorite === true).modify({ isFavorite: false });
    await db.programs.update(id, { isFavorite: true });
  });
}

// ── Дни программы ─────────────────────────────────────────

export async function getProgramDays(programId: number): Promise<ProgramDay[]> {
  return db.programDays.where('programId').equals(programId).sortBy('order');
}

export async function createProgramDay(programId: number, name: string): Promise<number> {
  const existing = await getProgramDays(programId);
  return db.programDays.add({ programId, name, order: existing.length });
}

export async function updateProgramDay(id: number, data: Partial<ProgramDay>): Promise<void> {
  await db.programDays.update(id, data);
}

export async function deleteProgramDay(id: number): Promise<void> {
  await db.programExercises.where('dayId').equals(id).delete();
  await db.programDays.delete(id);
}

// ── Упражнения программы ──────────────────────────────────

export async function getDayExercises(dayId: number): Promise<ProgramExercise[]> {
  return db.programExercises.where('dayId').equals(dayId).sortBy('order');
}

export async function createProgramExercise(
  dayId: number,
  data: Omit<ProgramExercise, 'id' | 'dayId' | 'order'>
): Promise<number> {
  const existing = await getDayExercises(dayId);
  return db.programExercises.add({ ...data, dayId, order: existing.length });
}

export async function updateProgramExercise(id: number, data: Partial<ProgramExercise>): Promise<void> {
  await db.programExercises.update(id, data);
}

export async function deleteProgramExercise(id: number): Promise<void> {
  await db.programExercises.delete(id);
}

// ── Тренировки ────────────────────────────────────────────

export async function getWorkouts(): Promise<Workout[]> {
  return db.workouts.orderBy('date').reverse().toArray();
}

export async function getWorkoutsByMonth(year: number, month: number): Promise<Workout[]> {
  const start = new Date(year, month, 1).getTime();
  const end   = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return db.workouts.where('date').between(start, end, true, true).toArray();
}

export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.filter(w => w.finishedAt === undefined).first();
}

export async function createWorkout(programId: number, dayId: number): Promise<number> {
  return db.workouts.add({ programId, dayId, date: Date.now() });
}

export async function finishWorkout(id: number): Promise<void> {
  await db.workouts.update(id, { finishedAt: Date.now() });
}

export async function deleteWorkout(id: number): Promise<void> {
  const exercises = await db.workoutExercises.where('workoutId').equals(id).toArray();
  for (const ex of exercises) {
    if (ex.id !== undefined) {
      await db.workoutSets.where('workoutExerciseId').equals(ex.id).delete();
    }
  }
  await db.workoutExercises.where('workoutId').equals(id).delete();
  await db.workouts.delete(id);
}

// ── Упражнения тренировки ─────────────────────────────────

export async function getWorkoutExercises(workoutId: number): Promise<WorkoutExercise[]> {
  return db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order');
}

export async function createWorkoutExercises(
  workoutId: number,
  exercises: ProgramExercise[]
): Promise<void> {
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

export async function updateWorkoutExerciseName(id: number, name: string): Promise<void> {
  await db.workoutExercises.update(id, { name });
}

// ── Подходы ───────────────────────────────────────────────

export async function getWorkoutSets(workoutExerciseId: number): Promise<WorkoutSet[]> {
  return db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('setNumber');
}

/**
 * Возвращает подходы того же упражнения из самой свежей предыдущей тренировки.
 * Упражнение сопоставляется по шаблону (programExerciseId), а если его нет —
 * по названию. Берётся ближайшая по дате тренировка раньше текущей, в которой
 * есть записанные подходы.
 */
export async function getPreviousExerciseSets(
  currentWorkoutId: number,
  currentDate: number,
  programExerciseId: number,
  exerciseName: string
): Promise<WorkoutSet[]> {
  const candidates = programExerciseId
    ? await db.workoutExercises.where('programExerciseId').equals(programExerciseId).toArray()
    : await db.workoutExercises.filter(x => x.name === exerciseName).toArray();

  const withDate = await Promise.all(
    candidates.map(async c => ({
      we: c,
      date: (await db.workouts.get(c.workoutId))?.date ?? 0,
    }))
  );

  const previous = withDate
    .filter(x => x.we.workoutId !== currentWorkoutId && x.date < currentDate)
    .sort((a, b) => b.date - a.date);

  for (const p of previous) {
    const sets = await db.workoutSets
      .where('workoutExerciseId').equals(p.we.id!)
      .sortBy('setNumber');
    if (sets.length > 0) return sets;
  }
  return [];
}

export async function addWorkoutSet(
  workoutExerciseId: number,
  setNumber: number,
  weight: number,
  reps: number
): Promise<number> {
  return db.workoutSets.add({ workoutExerciseId, setNumber, weight, reps, completedAt: Date.now() });
}

export async function updateWorkoutSet(id: number, data: Partial<WorkoutSet>): Promise<void> {
  await db.workoutSets.update(id, data);
}

export async function deleteWorkoutSet(id: number): Promise<void> {
  await db.workoutSets.delete(id);
}

// ── Импорт / Экспорт ─────────────────────────────────────

export async function exportAllData(): Promise<object> {
  const [programs, programDays, programExercises, workouts, workoutExercises, workoutSets] =
    await Promise.all([
      db.programs.toArray(),
      db.programDays.toArray(),
      db.programExercises.toArray(),
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.workoutSets.toArray(),
    ]);

  return { programs, programDays, programExercises, workouts, workoutExercises, workoutSets };
}

export async function importAllData(data: ReturnType<typeof exportAllData> extends Promise<infer T> ? T : never): Promise<void> {
  await db.transaction('rw',
    [db.programs, db.programDays, db.programExercises, db.workouts, db.workoutExercises, db.workoutSets],
    async () => {
      await db.programs.clear();
      await db.programDays.clear();
      await db.programExercises.clear();
      await db.workouts.clear();
      await db.workoutExercises.clear();
      await db.workoutSets.clear();

      const d = data as Record<string, unknown[]>;
      if (d.programs)         await db.programs.bulkAdd(d.programs as Program[]);
      if (d.programDays)      await db.programDays.bulkAdd(d.programDays as ProgramDay[]);
      if (d.programExercises) await db.programExercises.bulkAdd(d.programExercises as ProgramExercise[]);
      if (d.workouts)         await db.workouts.bulkAdd(d.workouts as Workout[]);
      if (d.workoutExercises) await db.workoutExercises.bulkAdd(d.workoutExercises as WorkoutExercise[]);
      if (d.workoutSets)      await db.workoutSets.bulkAdd(d.workoutSets as WorkoutSet[]);
    }
  );
}
