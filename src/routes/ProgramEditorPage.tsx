import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { db } from '../db/schema';
import type { Program, ProgramDay, ProgramExercise } from '../db/schema';
import {
  getProgramDays,
  getDayExercises,
  createProgramDay,
  updateProgramDay,
  deleteProgramDay,
  deleteProgram,
  deleteProgramExercise,
  setFavoriteProgram,
} from '../db/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { formatSetsRepsWeight } from '../utils/format';

// ── Типы для локального состояния ─────────────────────────

interface DayWithExercises {
  day: ProgramDay;
  exercises: ProgramExercise[];
}

// ── Компонент страницы ─────────────────────────────────────

export function ProgramEditorPage() {
  const { programId } = useParams<{ programId?: string }>();
  const navigate = useNavigate();
  const isNew = !programId;
  const pid = programId ? parseInt(programId) : null;

  const [name, setName] = useState('');
  const [days, setDays] = useState<DayWithExercises[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [editingDayName, setEditingDayName] = useState('');

  // Загружаем существующую программу
  const load = useCallback(async () => {
    if (!pid) return;
    const prog = await db.programs.get(pid);
    if (!prog) { navigate('/programs'); return; }
    setName(prog.name);

    const dayList = await getProgramDays(pid);
    const daysWithEx = await Promise.all(
      dayList.map(async day => ({
        day,
        exercises: await getDayExercises(day.id!),
      }))
    );
    setDays(daysWithEx);
    setLoading(false);
  }, [pid, navigate]);

  useEffect(() => {
    if (!isNew) load();
  }, [isNew, load]);

  // ── Сохранение ─────────────────────────────────────────

  const handleSave = async () => {
    const trimmed = name.trim() || 'Без названия';
    setSaving(true);
    try {
      if (isNew) {
        await db.programs.add({
          name: trimmed,
          isFavorite: false,
          createdAt: Date.now(),
        });
        navigate('/programs', { replace: true });
      } else if (pid) {
        await db.programs.update(pid, { name: trimmed });
        navigate('/programs');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Управление днями ───────────────────────────────────

  const addDay = async () => {
    if (!pid) {
      const trimmed = name.trim() || 'Без названия';
      const newId = await db.programs.add({
        name: trimmed,
        isFavorite: false,
        createdAt: Date.now(),
      });
      navigate(`/program/${newId}`, { replace: true });
      return; // После navigate компонент перемонтируется с новым pid
    }
    const letter = String.fromCharCode(65 + days.length); // A, B, C...
    const dayId = await createProgramDay(pid, `День ${letter}`);
    const newDay = await db.programDays.get(dayId);
    if (newDay) setDays(prev => [...prev, { day: newDay, exercises: [] }]);
  };

  const startEditDayName = (day: ProgramDay) => {
    setEditingDayId(day.id!);
    setEditingDayName(day.name);
  };

  const saveDayName = async () => {
    if (editingDayId === null) return;
    const trimmed = editingDayName.trim();
    if (trimmed) {
      await updateProgramDay(editingDayId, { name: trimmed });
      setDays(prev =>
        prev.map(d =>
          d.day.id === editingDayId ? { ...d, day: { ...d.day, name: trimmed } } : d
        )
      );
    }
    setEditingDayId(null);
  };

  const removeDay = async (dayId: number) => {
    await deleteProgramDay(dayId);
    setDays(prev => prev.filter(d => d.day.id !== dayId));
  };

  // ── Удаление программы ─────────────────────────────────

  const handleDeleteProgram = async () => {
    if (!pid) return;
await deleteProgram(pid);
    navigate('/programs');
  };

  // ── Render ─────────────────────────────────────────────

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
        <button className="push-header__back" onClick={() => navigate('/programs')}>
          <ChevronLeft size={16} />
          Назад
        </button>
        <span className="push-header__title">
          {isNew ? 'Новая программа' : 'Редактор'}
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
        {/* Название программы */}
        <div style={{ marginBottom: 24 }}>
          <label className="input-label">Название программы</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: Reg Park Beginner"
            autoFocus={isNew}
          />
        </div>

        {/* Дни */}
        {days.map(({ day, exercises }, idx) => (
          <DayCard
            key={day.id}
            day={day}
            exercises={exercises}
            isEditingName={editingDayId === day.id}
            editingName={editingDayName}
            onEditingNameChange={setEditingDayName}
            onStartEdit={() => startEditDayName(day)}
            onSaveEdit={saveDayName}
            onCancelEdit={() => setEditingDayId(null)}
            onDelete={() => removeDay(day.id!)}
            onAddExercise={() =>
              navigate(`/program/${pid}/exercise/new?dayId=${day.id}`)
            }
            onEditExercise={(exId: number) =>
              navigate(`/program/${pid}/exercise/${exId}`)
            }
            onDeleteExercise={async (exId: number) => {
              await deleteProgramExercise(exId);
              setDays(prev => prev.map(d =>
                d.day.id === day.id
                  ? { ...d, exercises: d.exercises.filter(ex => ex.id !== exId) }
                  : d
              ));
            }}
            onExercisesChange={(exs: ProgramExercise[]) =>
              setDays(prev =>
                prev.map(d => d.day.id === day.id ? { ...d, exercises: exs } : d)
              )
            }
            index={idx}
          />
        ))}

        {/* + Добавить день */}
        {!isNew && (
          <button
            onClick={addDay}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--surface)',
              border: '1px dashed var(--border-strong)',
              borderRadius: 16,
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Plus size={16} />
            Добавить день
          </button>
        )}

        {/* Удалить программу */}
        {!isNew && (
          <div style={{ marginTop: 24 }}>
            <button className="btn-danger" onClick={handleDeleteProgram}>
              Удалить программу
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Карточка дня ──────────────────────────────────────────

interface DayCardProps {
  day: ProgramDay;
  exercises: ProgramExercise[];
  isEditingName: boolean;
  editingName: string;
  onEditingNameChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onAddExercise: () => void;
  onEditExercise: (id: number) => void;
  onDeleteExercise: (id: number) => void;
  onExercisesChange: (exs: ProgramExercise[]) => void;
  index: number;
}

function DayCard({
  day,
  exercises,
  isEditingName,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
}: DayCardProps) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Заголовок дня */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {isEditingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <input
              className="input"
              style={{ height: 36, fontSize: 15, flex: 1 }}
              value={editingName}
              onChange={e => onEditingNameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
              autoFocus
            />
            <button onClick={onSaveEdit} style={{ color: 'var(--success)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Check size={18} />
            </button>
            <button onClick={onCancelEdit} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{day.name}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={onStartEdit}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="Переименовать день"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onDelete}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                aria-label="Удалить день"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Список упражнений */}
      {exercises.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 12, paddingLeft: 4 }}>
          Нет упражнений
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {exercises.map(ex => (
            <div key={ex.id} style={{ marginBottom: 4 }}>
              <SwipeToDelete onDelete={() => onDeleteExercise(ex.id!)} borderRadius={12}>
                <div
                  onClick={() => onEditExercise(ex.id!)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 8px',
                    background: 'var(--bg)',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  <GripVertical size={14} style={{ color: 'var(--text-soft)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                      {ex.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatSetsRepsWeight(ex.sets, ex.reps, ex.weight)}
                      {ex.progressionStep > 0 && (
                        <span style={{ color: 'var(--success)', marginLeft: 6 }}>
                          · шаг +{ex.progressionStep} кг
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft size={14} style={{ color: 'var(--text-soft)', transform: 'rotate(180deg)', flexShrink: 0 }} />
                </div>
              </SwipeToDelete>
            </div>
          ))}
        </div>
      )}

      {/* + Добавить упражнение */}
      <button
        onClick={onAddExercise}
        style={{
          width: '100%',
          padding: '10px',
          background: 'var(--accent-bg)',
          border: 'none',
          borderRadius: 12,
          color: 'var(--accent-text)',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Plus size={14} />
        Добавить упражнение
      </button>
    </div>
  );
}
