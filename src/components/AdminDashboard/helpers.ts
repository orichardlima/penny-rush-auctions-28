import { toZonedTime } from 'date-fns-tz';

export const formatPrice = (priceInReais: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(priceInReais || 0);
};

export const formatDateTimeLocal = (dateTimeString: string) => {
  if (dateTimeString && dateTimeString.includes('T') && dateTimeString.length >= 16) {
    return dateTimeString.slice(0, 16);
  }
  const date = new Date(dateTimeString);
  return date.toISOString().slice(0, 16);
};

export const formatDateTime = (dateString: string) => {
  const brazilTimezone = 'America/Sao_Paulo';
  const utcDate = new Date(dateString);
  const brazilDate = toZonedTime(utcDate, brazilTimezone);
  return brazilDate.toLocaleString('pt-BR');
};

export const getInitialStartTime = () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 1000);
  return future.toISOString().slice(0, 16);
};
