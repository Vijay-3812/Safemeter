import { formatInTimeZone } from 'date-fns-tz';
export const absoluteTime = (n: number) =>
  formatInTimeZone(n, 'Asia/Kolkata', 'dd MMM yyyy, HH:mm:ss') + ' IST';
export const clock = (n: number) => formatInTimeZone(n, 'Asia/Kolkata', 'HH:mm');
export const relativeTime = (n: number, now: number) => {
  const s = Math.max(0, Math.floor((now - n) / 1000));
  return s < 60
    ? `${s}s ago`
    : s < 3600
      ? `${Math.floor(s / 60)}m ago`
      : s < 86400
        ? `${Math.floor(s / 3600)}h ago`
        : `${Math.floor(s / 86400)}d ago`;
};
export const duration = (s: number | null) => {
  if (s === null) return '—';
  const seconds = Math.max(0, Math.round(s));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
export const average = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
