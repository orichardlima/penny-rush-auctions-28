// Helpers compartilhados de semana (segunda 00:00 -> domingo 23:59, horário Brasil)
// Espelham as regras usadas em src/hooks/useAdCenter.ts

export const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Ordem da semana segunda -> domingo
export const WEEK_HEADER = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export const formatDateBrazil = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getWeekEnd = (date: Date): Date => {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getWeekDays = (anchor: Date): { date: string; label: string; dayNumber: number; isToday: boolean; isFuture: boolean }[] => {
  const today = formatDateBrazil(new Date());
  const start = getWeekStart(anchor);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = formatDateBrazil(d);
    days.push({
      date: dateStr,
      label: WEEK_HEADER[i],
      dayNumber: d.getDate(),
      isToday: dateStr === today,
      isFuture: dateStr > today,
    });
  }
  return days;
};

export const formatWeekRangeLabel = (anchor: Date): string => {
  const s = getWeekStart(anchor);
  const e = getWeekEnd(anchor);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(s)} – ${fmt(e)}`;
};
