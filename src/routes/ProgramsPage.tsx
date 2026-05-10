import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/schema';
import type { Program } from '../db/schema';
import { setFavoriteProgram, getProgramDays, getDayExercises, deleteProgram } from '../db/queries';
import { SwipeToDelete } from '../components/SwipeToDelete';

interface ProgramRow {
  program: Program;
  daysCount: number;
  exercisesCount: number;
}

export function ProgramsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProgramRow[]>([]);

  const load = useCallback(async () => {
    const programs = await db.programs.toArray();
    const result = await Promise.all(
      programs.map(async p => {
        const days = await getProgramDays(p.id!);
        let exercisesCount = 0;
        for (const day of days) {
          const exs = await getDayExercises(day.id!);
          exercisesCount += exs.length;
        }
        return { program: p, daysCount: days.length, exercisesCount };
      })
    );
    setRows(result);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFavorite = async (p: Program, e: React.MouseEvent) => {
    e.stopPropagation();
    if (p.isFavorite) {
      await db.programs.update(p.id!, { isFavorite: false });
    } else {
      await setFavoriteProgram(p.id!);
    }
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Программы</h1>
        <button
          className="btn-text"
          onClick={() => navigate('/program/new')}
        >
          + Новая
        </button>
      </div>

      <div className="page-inner">
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-soft)', fontSize: 14 }}>
            Нет программ.{' '}
            <button className="btn-text" onClick={() => navigate('/program/new')}>
              Создать первую
            </button>
          </div>
        ) : (
          rows.map(({ program: p, daysCount, exercisesCount }) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <SwipeToDelete onDelete={async () => { await deleteProgram(p.id!); load(); }}>
                <div
                  className={`program-card${p.isFavorite ? ' program-card--favorite' : ''}`}
                  style={{ marginBottom: 0 }}
                  onClick={() => navigate(`/program/${p.id}`)}
                >
                  <div className="program-card__name-row">
                    <span className="program-card__name">{p.name}</span>
                    <button
                      onClick={e => toggleFavorite(p, e)}
                      aria-label={p.isFavorite ? 'Убрать из избранного' : 'В избранное'}
                      style={{ color: p.isFavorite ? 'var(--accent)' : 'var(--text-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Star size={20} fill={p.isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
                    </button>
                  </div>
                  <div className="program-card__info">
                    {daysCount} {plural(daysCount, 'день', 'дня', 'дней')} · {exercisesCount} упражн.
                  </div>
                </div>
              </SwipeToDelete>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod = n % 100;
  if (mod >= 11 && mod <= 19) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
