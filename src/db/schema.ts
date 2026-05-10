import Dexie, { type Table } from 'dexie';

export interface Program {
  id?: number;
  name: string;
  isFavorite: boolean;
  createdAt: number;
}

export interface ProgramDay {
  id?: number;
  programId: number;
  name: string;    // "День A", "Верх", и т.д.
  order: number;   // порядок в программе
}

export interface ProgramExercise {
  id?: number;
  dayId: number;
  name: string;
  sets: number;            // целевое число подходов
  reps: number;            // целевые повторы
  weight: number;          // стартовый вес, кг (≥ 0)
  progressionStep: number; // шаг прибавки кг (0 = без прогрессии)
  comment: string;
  order: number;
}

export interface Workout {
  id?: number;
  date: number;         // timestamp начала
  programId: number;
  dayId: number;
  finishedAt?: number;  // timestamp завершения
  note?: string;
}

export interface WorkoutExercise {
  id?: number;
  workoutId: number;
  programExerciseId: number; // ссылка на шаблон
  name: string;              // копия имени на момент старта
  order: number;
  comment: string;
}

export interface WorkoutSet {
  id?: number;
  workoutExerciseId: number;
  setNumber: number;
  weight: number;      // ≥ 0, дробное допускается
  reps: number;        // ≥ 0, дробное допускается
  completedAt: number;
}

export class WorkoutDB extends Dexie {
  programs!: Table<Program>;
  programDays!: Table<ProgramDay>;
  programExercises!: Table<ProgramExercise>;
  workouts!: Table<Workout>;
  workoutExercises!: Table<WorkoutExercise>;
  workoutSets!: Table<WorkoutSet>;

  constructor() {
    super('WorkoutDB');
    this.version(1).stores({
      programs:         '++id, isFavorite',
      programDays:      '++id, programId, order',
      programExercises: '++id, dayId, order',
      workouts:         '++id, date, programId, dayId',
      workoutExercises: '++id, workoutId, programExerciseId',
      workoutSets:      '++id, workoutExerciseId',
    });
  }
}

export const db = new WorkoutDB();
