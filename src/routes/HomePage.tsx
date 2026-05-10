import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, TrendingUp, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import type { Program, ProgramDay, ProgramExercise } from '../db/schema';
import { getFavoriteProgram } from '../db/queries';
import { getNextDay, startWorkout } from '../features/workout';
import { getRecommendedWeight } from '../features/progression';
import { formatSetsRepsWeight, formatNum } from '../utils/format';

interface ExerciseRow {
  ex: ProgramExercise;
  recommendedWeight: number;
  willProgress: boolean;
}

interface HomeState {
  program: Program;
  nextDay: ProgramDay;
  exercises: ExerciseRow[];
  activeWorkoutId: number | null;
}

export function HomePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<HomeState | null>(null);
  const [noProgram, setNoProgram] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const program = await getFavoriteProgram();
    if (!program) {
      setNoProgram(true);
      return;
    }
    setNoProgram(false);

    const nextDay = await getNextDay(program.id!);
    if (!nextDay) {
      setState({ program, nextDay: { id: 0, programId: program.id!, name: '', order: 0 }, exercises: [], activeWorkoutId: null });
      return;
    }

    const rawExercises = await db.programExercises
      .where('dayId').equals(nextDay.id!)
      .sortBy('order');

    const exercises = await Promise.all(
      rawExercises.map(async ex => {
        const { weight, willProgress } = await getRecommendedWeight(ex.id!);
        return { ex, recommendedWeight: weight, willProgress };
      })
    );

    const activeWorkout = await db.workouts
      .where('programId').equals(program.id!)
      .filter(w => !w.finishedAt)
      .last();

    setState({
      program,
      nextDay,
      exercises,
      activeWorkoutId: activeWorkout?.id ?? null,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!state) return;
    setStarting(true);
    try {
      const wid = await startWorkout(state.program.id!, state.nextDay.id!);
      navigate(`/workout/${wid}`);
    } finally {
      setStarting(false);
    }
  };

  if (noProgram) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Тренировка</h1>
        </div>
        <EmptyState onCreateProgram={() => navigate('/program/new')} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Тренировка</h1>
        </div>
      </div>
    );
  }

  const { program, nextDay, exercises, activeWorkoutId } = state;

  return (
    <div className="page">
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <h1 className="page-title">Тренировка</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          {program.name}
        </span>
      </div>

      <div className="page-inner" style={{ paddingBottom: 16 }}>
        {/* Карточка дня */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {nextDay.name || 'День'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {exercises.length} упражн.
            </span>
          </div>

          {exercises.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-soft)', paddingBottom: 4 }}>
              В этом дне нет упражнений
            </div>
          ) : (
            <div>
              {exercises.map(({ ex, recommendedWeight, willProgress }) => (
                <div
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                      {ex.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatSetsRepsWeight(ex.sets, ex.reps, recommendedWeight)}
                    </div>
                  </div>
                  {willProgress && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      <TrendingUp size={12} />
                      +{formatNum(ex.progressionStep)} кг
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка */}
        {activeWorkoutId ? (
          <button
            className="btn-primary"
            onClick={() => navigate(`/workout/${activeWorkoutId}`)}
          >
            Продолжить тренировку
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={handleStart}
            disabled={starting || exercises.length === 0}
          >
            {starting ? 'Запуск…' : 'Начать тренировку'}
          </button>
        )}

        {/* Ссылка на программы */}
        <button
          onClick={() => navigate('/programs')}
          style={{
            width: '100%',
            marginTop: 12,
            padding: '14px 16px',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span>Управление программами</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreateProgram }: { onCreateProgram: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Dumbbell size={40} strokeWidth={1.5} />
      </div>
      <h2 className="empty-state__title">Готов начать?</h2>
      <p className="empty-state__text">Создай программу и отметь её как любимую — тогда здесь появится план на сегодня</p>
      <button className="btn-primary" onClick={onCreateProgram} style={{ maxWidth: 280 }}>
        Создать программу
      </button>
    </div>
  );
}
