export const SLA = { accept: 120, arrive: 480 };
export const slaState = (seconds: number, target: number) =>
  seconds > target ? 'breached' : seconds > target * 0.8 ? 'warning' : 'healthy';
