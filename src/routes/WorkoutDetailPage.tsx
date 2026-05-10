import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { db } from '../db/schema';
import type { Workout, WorkoutExercise, WorkoutSet } from '../db/schema';
import { deleteWorkout } from '../db/queries';
import { formatNum } from '../utils/format';

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

interface ExData {
  we: WorkoutExercise;
  sets: WorkoutSet[];
}

export function WorkoutDetailPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const wid = workoutId ? parseInt(workoutId) : null;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<ExData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!wid) return;
    const w = await db.workouts.get(wid);
    if (!w) { navigate('/calendar'); return; }
    setWorkout(w);

    const wes = await db.workoutExercises.where('workoutId').equals(wid).sortBy('order');
    const exData: ExData[] = await Promise.all(
      wes.map(async we => {
        const sets = await db.workoutSets
          .where('workoutExerciseId').equals(we.id!)
          .sortBy('setNumber');
        return { we, sets };
      })
    );
    setExercises(exData);
    setLoading(false);
  }, [wid, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!wid) return;
await deleteWorkout(wid);
    navigate('/calendar');
  };

  if (loading) {
    return (
      <div className="fullscreen-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Загрузка…</span>
      </div>
    );
  }

  if (!workout) return null;

  const d = new Date(workout.date);
  const dateLabel = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);

  return (
    <div className="fullscreen-page" style={{ overflowY: 'auto' }}>
      <div className="push-header">
        <button className="push-header__back" onClick={() => navigate('/calendar')}>
          <ChevronLeft size={16} />
          Календарь
        </button>
        <span className="push-header__title">{dateLabel}</span>
        <button
          onClick={handleDelete}
          style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          aria-label="Удалить тренировку"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div style={{ padding: '0 20px 60px' }}>
        {/* Сводка */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
          <Stat label="Упражнений" value={String(exercises.length)} />
          <Stat label="Подходов" value={String(totalSets)} />
          {workout.finishedAt && (
            <Stat
              label="Время"
              value={formatDuration(workout.date, workout.finishedAt)}
            />
          )}
        </div>

        {/* Упражнения */}
        {exercises.map(({ we, sets }) => (
          <div key={we.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: sets.length > 0 ? 12 : 0 }}>
              {we.name}
            </div>

            {sets.length > 0 && (
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Вес</th>
                      <th>Повторы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map(s => (
                      <tr key={s.id}>
                        <td>{s.setNumber}</td>
                        <td>{s.weight === 0 ? 'масса тела' : `${formatNum(s.weight)} кг`}</td>
                        <td>{formatNum(s.reps)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sets.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-soft)' }}>Подходы не записаны</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

function formatDuration(start: number, end: number): string {
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} м`;
}
