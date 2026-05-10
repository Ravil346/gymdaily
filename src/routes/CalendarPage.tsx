import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import type { Program, ProgramDay, Workout } from '../db/schema';
import { getWorkoutsByMonth, deleteWorkout, getFavoriteProgram, getProgramDays } from '../db/queries';
import { startWorkout } from '../features/workout';
import { SwipeToDelete } from '../components/SwipeToDelete';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

interface WorkoutRow {
  workout: Workout;
  dayName: string;
  exercisesCount: number;
}

export function CalendarPage() {
  const today = new Date();
  const navigate = useNavigate();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rows, setRows] = useState<WorkoutRow[]>([]);
  // day-of-month → workoutId (первая/последняя за день)
  const [workoutMap, setWorkoutMap] = useState(new Map<number, number>());

  // Шторка выбора дня программы
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const [favProgram, setFavProgram] = useState<Program | null>(null);
  const [progDays, setProgDays] = useState<ProgramDay[]>([]);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const workouts = await getWorkoutsByMonth(year, month);
    workouts.sort((a, b) => b.date - a.date);

    const result: WorkoutRow[] = await Promise.all(
      workouts.map(async w => {
        const day = await db.programDays.get(w.dayId);
        const exCount = await db.workoutExercises.where('workoutId').equals(w.id!).count();
        return { workout: w, dayName: day?.name ?? 'Тренировка', exercisesCount: exCount };
      })
    );
    setRows(result);

    // Строим карту day → workoutId (берём первую, т.е. самую свежую после сортировки)
    const map = new Map<number, number>();
    for (const w of workouts) {
      const d = new Date(w.date).getDate();
      if (!map.has(d)) map.set(d, w.id!);
    }
    setWorkoutMap(map);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Тап по дате
  const handleDayPress = async (day: number) => {
    const wid = workoutMap.get(day);
    if (wid !== undefined) {
      navigate(`/workout/${wid}`, { state: { from: 'calendar' } });
      return;
    }
    // Нет тренировки — открываем шторку
    const date = new Date(year, month, day);
    setPickerDate(date);
    setLoadingPicker(true);
    const prog = await getFavoriteProgram();
    setFavProgram(prog ?? null);
    if (prog) {
      const days = await getProgramDays(prog.id!);
      setProgDays(days);
    } else {
      setProgDays([]);
    }
    setLoadingPicker(false);
  };

  // Создаём тренировку за выбранную дату
  const handleCreateWorkout = async (dayId: number) => {
    if (!favProgram || !pickerDate) return;
    setStarting(true);
    try {
      const wid = await startWorkout(favProgram.id!, dayId, pickerDate.getTime());
      setPickerDate(null);
      navigate(`/workout/${wid}`, { state: { from: 'calendar' } });
    } finally {
      setStarting(false);
    }
  };

  const calDays = buildCalendarDays(year, month);

  const pickerDateLabel = pickerDate
    ? `${pickerDate.getDate()} ${MONTHS_GEN[pickerDate.getMonth()]} ${pickerDate.getFullYear()}`
    : '';

  return (
    <div className="page">
      <div className="page-inner">
        {/* Месяц + навигация */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {MONTHS_RU[month]} {year}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon" onClick={prevMonth} aria-label="Предыдущий месяц">
              <ChevronLeft size={18} />
            </button>
            <button className="btn-icon" onClick={nextMonth} aria-label="Следующий месяц">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Сетка */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 0' }}>
              {d}
            </div>
          ))}
          {calDays.map((day, i) => (
            <CalendarDay
              key={i}
              day={day}
              today={today}
              year={year}
              month={month}
              hasWorkout={day !== null && workoutMap.has(day)}
              onClick={day ? () => handleDayPress(day) : undefined}
            />
          ))}
        </div>

        {/* Список тренировок */}
        <div style={{ marginTop: 28 }}>
          <div className="section-label">
            {rows.length} {plural(rows.length, 'тренировка', 'тренировки', 'тренировок')} в {MONTHS_GEN[month]}
          </div>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-soft)', fontSize: 14 }}>
              В этом месяце тренировок нет
            </div>
          ) : (
            rows.map(({ workout, dayName, exercisesCount }) => {
              const d = new Date(workout.date);
              const label = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
              return (
                <div key={workout.id} style={{ marginBottom: 8 }}>
                  <SwipeToDelete onDelete={async () => { await deleteWorkout(workout.id!); load(); }}>
                    <div
                      className="workout-item"
                      onClick={() => navigate(`/workout/${workout.id}`, { state: { from: 'calendar' } })}
                    >
                      <div className="workout-item__header">
                        <span className="workout-item__date">{label}</span>
                        {!workout.finishedAt && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '2px 8px', borderRadius: 8 }}>
                            В процессе
                          </span>
                        )}
                      </div>
                      <div className="workout-item__summary">
                        {dayName} · {exercisesCount} упражн.
                      </div>
                    </div>
                  </SwipeToDelete>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Шторка выбора дня программы */}
      {pickerDate && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setPickerDate(null)}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {pickerDateLabel}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Выбери день программы
            </div>

            {loadingPicker ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Загрузка…
              </div>
            ) : !favProgram ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Нет избранной программы. Отметь программу звёздочкой на вкладке «Программы».
              </div>
            ) : progDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                В программе нет дней.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {progDays.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleCreateWorkout(d.id!)}
                    disabled={starting}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      textAlign: 'left',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setPickerDate(null)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'none',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ячейка дня ────────────────────────────────────────────

function CalendarDay({
  day, today, year, month, hasWorkout, onClick,
}: {
  day: number | null;
  today: Date;
  year: number;
  month: number;
  hasWorkout: boolean;
  onClick?: () => void;
}) {
  if (day === null) return <div />;

  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isFuture = new Date(year, month, day) > today;

  let bg = 'transparent';
  let color = isFuture ? 'var(--text-soft)' : 'var(--text)';
  let border = 'none';

  if (hasWorkout && isToday) {
    bg = 'var(--accent)'; color = '#fff'; border = '3px solid var(--accent)';
  } else if (hasWorkout) {
    bg = 'var(--accent)'; color = '#fff';
  } else if (isToday) {
    color = 'var(--accent)'; border = '2px solid var(--accent)';
  }

  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 600,
        borderRadius: '50%',
        background: bg,
        color,
        border,
        cursor: isFuture ? 'default' : 'pointer',
        opacity: isFuture ? 0.4 : 1,
      }}
    >
      {day}
    </div>
  );
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod = n % 100;
  if (mod >= 11 && mod <= 19) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
