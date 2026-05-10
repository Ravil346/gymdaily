import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { X, CheckCircle2 } from 'lucide-react';
import { db } from '../db/schema';
import type { WorkoutExercise, WorkoutSet, ProgramExercise } from '../db/schema';
import { addWorkoutSet, deleteWorkoutSet, finishWorkout } from '../db/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { formatNum, parseInputNum } from '../utils/format';

interface ExData {
  we: WorkoutExercise;
  template: ProgramExercise | null;
  sets: WorkoutSet[];
}

// ── Панель одного упражнения ──────────────────────────────

interface PanelProps {
  ex: ExData;
  isLast: boolean;
  suppressSwipe: React.MutableRefObject<boolean>;
  onRecord: (weight: number, reps: number, setNumber: number) => Promise<void>;
  onDelete: (setId: number) => void;
  onFinish: () => void;
  finishing: boolean;
}

function ExercisePanel({ ex, isLast, suppressSwipe, onRecord, onDelete, onFinish, finishing }: PanelProps) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const last = ex.sets[ex.sets.length - 1];
    const w = last?.weight ?? ex.template?.weight ?? 0;
    const r = last?.reps ?? ex.template?.reps ?? 5;
    setWeight(w === 0 ? '' : String(w).replace('.', ','));
    setReps(String(r));
  }, [ex.sets.length, ex.template?.id]);

  const handleRecord = async () => {
    setRecording(true);
    try {
      await onRecord(parseInputNum(weight), Math.max(0, parseInt(reps) || 0), ex.sets.length + 1);
    } finally {
      setRecording(false);
    }
  };

  const targetSets = ex.template?.sets ?? 0;
  const doneSets = ex.sets.length;
  const allDone = targetSets > 0 && doneSets >= targetSets;
  const showFinish = isLast && allDone;

  return (
    <div style={{
      minWidth: '100vw',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 20px',
    }}>
      {/* Название */}
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, flexShrink: 0, marginBottom: 4 }}>
        {ex.we.name}
      </h2>

      {/* Цель */}
      {ex.template && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 14, flexShrink: 0 }}>
          {ex.template.sets} × {ex.template.reps} повт
          {ex.template.weight > 0 ? ` · ${formatNum(ex.template.weight)} кг` : ' · масса тела'}
        </div>
      )}

      {/* Список подходов */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
        {ex.sets.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-soft)', paddingBottom: 8 }}>
            Свайп влево — удалить подход
          </div>
        )}
        {ex.sets.map(set => (
          <div key={set.id} style={{ marginBottom: 6 }}>
            <SwipeToDelete onDelete={() => onDelete(set.id!)} suppressRef={suppressSwipe} borderRadius={12}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 1fr',
                gap: 8,
                alignItems: 'center',
                padding: '13px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-soft)' }}>{set.setNumber}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {set.weight === 0 ? 'масса тела' : `${formatNum(set.weight)} кг`}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {formatNum(set.reps)} повт
                </span>
              </div>
            </SwipeToDelete>
          </div>
        ))}
        {allDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 4px', color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            Все подходы выполнены
          </div>
        )}
      </div>

      {/* Ввод */}
      <div style={{ flexShrink: 0, paddingBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
          <div>
            <label className="input-label">Вес (кг)</label>
            <input
              className="input input-large"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="input-label">Повторы</label>
            <input
              className="input input-large"
              type="number"
              inputMode="numeric"
              min="0"
              value={reps}
              onChange={e => setReps(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleRecord}
          disabled={recording}
          style={{ marginBottom: showFinish ? 10 : 0 }}
        >
          {recording ? '…' : `Записать подход ${doneSets + 1}`}
        </button>

        {showFinish && (
          <button
            className="btn-primary"
            onClick={onFinish}
            disabled={finishing}
            style={{ marginTop: 0, background: 'var(--success)', boxShadow: '0 4px 14px rgba(72,199,116,0.3)' }}
          >
            {finishing ? '…' : 'Завершить тренировку'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Основной экран ────────────────────────────────────────

export function WorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const wid = workoutId ? parseInt(workoutId) : null;
  const fromCalendar = (location.state as { from?: string } | null)?.from === 'calendar';
  const returnTo = fromCalendar ? '/calendar' : '/';

  const [exercises, setExercises] = useState<ExData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [alreadyFinished, setAlreadyFinished] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const suppressSwipe = useRef(false);
  const currentIdxRef = useRef(0);
  const exLenRef = useRef(0);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { exLenRef.current = exercises.length; }, [exercises.length]);

  const load = useCallback(async () => {
    if (!wid) return;
    const wes = await db.workoutExercises.where('workoutId').equals(wid).sortBy('order');
    const result: ExData[] = await Promise.all(
      wes.map(async we => {
        const template = we.programExerciseId
          ? (await db.programExercises.get(we.programExerciseId)) ?? null
          : null;
        const sets = await db.workoutSets
          .where('workoutExerciseId').equals(we.id!)
          .sortBy('setNumber');
        return { we, template, sets };
      })
    );
    const workout = await db.workouts.get(wid);
    setAlreadyFinished(!!workout?.finishedAt);
    setExercises(result);
    setLoading(false);
  }, [wid]);

  useEffect(() => { load(); }, [load]);

  // Навигация с анимацией
  const goTo = useCallback((idx: number) => {
    setIsAnimating(true);
    setDragOffset(0);
    setCurrentIdx(idx);
    setTimeout(() => setIsAnimating(false), 300);
  }, []);

  // Свайп-карусель — нативные listener'ы, carouselRef всегда смонтирован
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    let sx = 0, sy = 0;
    let dir: 'h' | 'v' | null = null;

    const onStart = (e: TouchEvent) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dir = null;
      setIsAnimating(false);
    };

    const onMove = (e: TouchEvent) => {
      if (suppressSwipe.current) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (dir === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      if (dir === 'h') {
        e.preventDefault();
        let offset = dx;
        if (currentIdxRef.current === 0 && dx > 0) offset = 0;
        if (currentIdxRef.current === exLenRef.current - 1 && dx < 0) offset = 0;
        setDragOffset(offset);
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (suppressSwipe.current || dir !== 'h') {
        setIsAnimating(true);
        setDragOffset(0);
        setTimeout(() => setIsAnimating(false), 300);
        return;
      }
      const dx = e.changedTouches[0].clientX - sx;
      setIsAnimating(true);
      setDragOffset(0);
      if (dx < -60 && currentIdxRef.current < exLenRef.current - 1) {
        setCurrentIdx(i => i + 1);
      } else if (dx > 60 && currentIdxRef.current > 0) {
        setCurrentIdx(i => i - 1);
      }
      setTimeout(() => setIsAnimating(false), 300);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []); // carouselRef всегда смонтирован — пустые deps корректны

  const handleRecord = async (exIdx: number, weight: number, reps: number, setNumber: number) => {
    const ex = exercises[exIdx];
    const newId = await addWorkoutSet(ex.we.id!, setNumber, weight, reps);
    setExercises(prev => prev.map((e, i) =>
      i === exIdx
        ? { ...e, sets: [...e.sets, { id: newId, workoutExerciseId: ex.we.id!, setNumber, weight, reps, completedAt: Date.now() }] }
        : e
    ));
  };

  const handleDeleteSet = async (exIdx: number, setId: number) => {
    await deleteWorkoutSet(setId);
    setExercises(prev => prev.map((e, i) =>
      i === exIdx ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e
    ));
  };

  const handleFinish = async () => {
    if (!wid) return;
    setFinishing(true);
    try {
      if (!alreadyFinished) await finishWorkout(wid);
      navigate(returnTo);
    } finally {
      setFinishing(false);
    }
  };

  const handleClose = () => {
    navigate(returnTo);
  };

  const total = exercises.length;
  const translateX = `calc(-${currentIdx} * 100vw + ${dragOffset}px)`;

  return (
    <div className="fullscreen-page" style={{ overflow: 'hidden' }}>

      {/* Шапка */}
      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', flexShrink: 0 }}>
          <button className="btn-icon" onClick={handleClose} aria-label="Выйти">
            <X size={18} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {total > 0 ? `${currentIdx + 1} из ${total}` : '—'}
          </span>
          {alreadyFinished ? (
            <button
              onClick={() => navigate(returnTo)}
              style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minWidth: 64, textAlign: 'right' }}
            >
              Готово
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={finishing}
              style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minWidth: 64, textAlign: 'right' }}
            >
              {finishing ? '…' : 'Завершить'}
            </button>
          )}
        </div>
      )}

      {/* Точки-навигация */}
      {!loading && total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 20px 12px', flexShrink: 0 }}>
          {exercises.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === currentIdx ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === currentIdx ? 'var(--accent)' : 'var(--border-strong)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.2s ease',
                flexShrink: 0,
              }}
              aria-label={`Упражнение ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Карусель — всегда смонтирована (нужна для touch listener) */}
      <div
        ref={carouselRef}
        style={{ flex: 1, overflow: 'hidden', touchAction: 'pan-y' }}
      >
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Загрузка…</span>
          </div>
        ) : total === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Нет упражнений
          </div>
        ) : (
          <div style={{
            display: 'flex',
            height: '100%',
            transform: `translateX(${translateX})`,
            transition: isAnimating ? 'transform 0.3s ease' : 'none',
            willChange: 'transform',
          }}>
            {exercises.map((ex, i) => (
              <ExercisePanel
                key={ex.we.id}
                ex={ex}
                isLast={i === total - 1}
                suppressSwipe={suppressSwipe}
                onRecord={(w, r, n) => handleRecord(i, w, r, n)}
                onDelete={(setId) => handleDeleteSet(i, setId)}
                onFinish={handleFinish}
                finishing={finishing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
