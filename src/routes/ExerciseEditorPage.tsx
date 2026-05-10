import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { db } from '../db/schema';
import {
  createProgramExercise,
  updateProgramExercise,
  deleteProgramExercise,
} from '../db/queries';
import { parseInputNum } from '../utils/format';

export function ExerciseEditorPage() {
  const { programId, exerciseId } = useParams<{ programId: string; exerciseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isNew = exerciseId === 'new';
  const pid = programId ? parseInt(programId) : null;
  const exId = !isNew && exerciseId ? parseInt(exerciseId) : null;
  const dayIdFromQuery = searchParams.get('dayId');
  const dayId = dayIdFromQuery ? parseInt(dayIdFromQuery) : null;

  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('5');
  const [weight, setWeight] = useState('0');
  const [progressionStep, setProgressionStep] = useState('2,5');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew && exId) {
      db.programExercises.get(exId).then(ex => {
        if (!ex) { navigate(-1); return; }
        setName(ex.name);
        setSets(String(ex.sets));
        setReps(String(ex.reps));
        setWeight(String(ex.weight).replace('.', ','));
        setProgressionStep(String(ex.progressionStep).replace('.', ','));
        setComment(ex.comment);
        setLoading(false);
      });
    }
  }, [isNew, exId, navigate]);

  const handleSave = async () => {
    const trimmedName = name.trim() || 'Без названия';
    const data = {
      name: trimmedName,
      sets: Math.max(1, parseInt(sets) || 1),
      reps: Math.max(1, parseInt(reps) || 1),
      weight: parseInputNum(weight),
      progressionStep: parseInputNum(progressionStep),
      comment,
    };

    setSaving(true);
    try {
      if (isNew) {
        if (!dayId) return;
        await createProgramExercise(dayId, data);
      } else if (exId) {
        await updateProgramExercise(exId, data);
      }
      navigate(`/program/${pid}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!exId) return;
await deleteProgramExercise(exId);
    navigate(`/program/${pid}`, { replace: true });
  };

  if (loading) {
    return (
      <div className="fullscreen-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Загрузка…</span>
      </div>
    );
  }

  return (
    <div className="fullscreen-page" style={{ overflowY: 'auto' }}>
      {/* Шапка */}
      <div className="push-header">
        <button className="push-header__back" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
          Назад
        </button>
        <span className="push-header__title">
          {isNew ? 'Новое упражнение' : 'Упражнение'}
        </span>
        <button
          className="push-header__action"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '…' : 'Готово'}
        </button>
      </div>

      <div style={{ padding: '0 20px 60px' }}>
        {/* Название */}
        <div style={{ marginBottom: 20 }}>
          <label className="input-label">Название упражнения</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Приседания со штангой"
            autoFocus={isNew}
          />
        </div>

        {/* Подходы и повторы */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label className="input-label">Подходы</label>
            <input
              className="input input-large"
              type="number"
              inputMode="numeric"
              min="1"
              value={sets}
              onChange={e => setSets(e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">Повторы</label>
            <input
              className="input input-large"
              type="number"
              inputMode="numeric"
              min="1"
              value={reps}
              onChange={e => setReps(e.target.value)}
            />
          </div>
        </div>

        {/* Вес и прогрессия */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label className="input-label">Вес (кг)</label>
            <input
              className="input input-large"
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="0 = масса тела"
            />
          </div>
          <div>
            <label className="input-label">Шаг прогрессии</label>
            <input
              className="input input-large"
              type="text"
              inputMode="decimal"
              value={progressionStep}
              onChange={e => setProgressionStep(e.target.value)}
              placeholder="0 = без шага"
            />
          </div>
        </div>

        {/* Комментарий */}
        <div style={{ marginBottom: 32 }}>
          <label className="input-label">Комментарий</label>
          <textarea
            className="input"
            style={{ height: 80, padding: '12px 16px', resize: 'none', lineHeight: 1.4 }}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Техника, заметки…"
          />
        </div>

        {/* Удалить */}
        {!isNew && (
          <button className="btn-danger" onClick={handleDelete}>
            Удалить упражнение
          </button>
        )}
      </div>
    </div>
  );
}
