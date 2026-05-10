const RU = 'ru-RU';

export function formatNum(n: number): string {
  return n.toLocaleString(RU, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function formatWeight(kg: number): string {
  if (kg === 0) return 'масса тела';
  return `${formatNum(kg)} кг`;
}

export function formatReps(reps: number): string {
  return `${formatNum(reps)} повт`;
}

export function formatSetsRepsWeight(sets: number, reps: number, weight: number): string {
  const w = weight === 0 ? 'масса тела' : `${formatNum(weight)} кг`;
  return `${sets} × ${formatNum(reps)} · ${w}`;
}

/** Парсит строку ввода (принимает запятую и точку как разделитель) */
export function parseInputNum(s: string): number {
  const normalized = s.trim().replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : Math.max(0, n);
}

/** Округляет вес до шага 0.25 */
export function roundToStep(value: number, step = 0.25): number {
  if (step === 0) return value;
  return Math.round(value / step) * step;
}
