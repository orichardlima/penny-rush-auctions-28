import { toZonedTime } from 'date-fns-tz';

const BAHIA_TZ = 'America/Bahia';

/**
 * Formata a data/hora de liberação da carência no fuso da Bahia.
 * Ex.: "31/08/2026 às 19:09"
 */
export function formatReleaseDateTime(dateString: string): string {
  const zoned = toZonedTime(new Date(dateString), BAHIA_TZ);
  const date = zoned.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = zoned.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} às ${time}`;
}

/**
 * Texto curto de tempo restante até a liberação.
 * Ex.: "faltam 8h", "faltam 2 dias", "liberação em instantes"
 */
export function formatTimeUntilRelease(dateString: string, now: Date = new Date()): string {
  const diffMs = new Date(dateString).getTime() - now.getTime();
  if (diffMs <= 0) return 'liberação em instantes';

  const diffMinutes = Math.ceil(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `faltam ${diffMinutes} min`;

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours <= 36) return `faltam ${diffHours}h`;

  const diffDays = Math.ceil(diffHours / 24);
  return `faltam ${diffDays} dias`;
}
