export const severity = (g: number) =>
  g < 5
    ? { label: 'Low', level: 1, color: 'var(--severity-low)' }
    : g < 8
      ? { label: 'Moderate', level: 2, color: 'var(--severity-moderate)' }
      : g <= 11
        ? { label: 'Severe', level: 3, color: 'var(--severity-severe)' }
        : { label: 'Critical', level: 4, color: 'var(--severity-critical)' };
export const statusLabel = {
  alerted: 'Alerted',
  responder_assigned: 'Assigned',
  responder_arrived: 'Arrived',
  closed: 'Closed',
  cancelled: 'Cancelled',
};
