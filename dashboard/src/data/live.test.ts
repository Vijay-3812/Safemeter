import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulatedSource } from './source';
import { checkConsistency, useDashboardStore } from '../store/useDashboardStore';
import { generateIncidents } from './simulation';
import { severity } from '../lib/severity';
afterEach(() => vi.useRealTimers());
describe('live source and local actions', () => {
  it('emits consistent snapshots between 20 and 40 seconds and cleans up', async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 9, 23, 12);
    vi.setSystemTime(now);
    const source = new SimulatedSource(42, now);
    const listener = vi.fn();
    const stop = source.subscribe(listener);
    await vi.advanceTimersByTimeAsync(19999);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20001);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(checkConsistency(listener.mock.calls[0][0])).toBe(true);
    stop();
    await vi.advanceTimersByTimeAsync(120000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('keeps a local false-alarm decision when a source snapshot refreshes', () => {
    const rows = generateIncidents(42);
    useDashboardStore.setState({ incidents: [], localOverrides: {}, toasts: [] });
    const store = useDashboardStore.getState();
    store.setIncidents(rows);
    const alert = rows.find((i) => i.status === 'alerted')!;
    store.action(alert.id, 'cancel');
    store.setIncidents(rows);
    const result = useDashboardStore.getState().incidents.find((i) => i.id === alert.id)!;
    expect(result.status).toBe('cancelled');
    expect(result.acceptTime).toBeNull();
    expect(result.arriveTime).toBeNull();
    expect(checkConsistency(useDashboardStore.getState().incidents)).toBe(true);
  });
  it('uses explicit impact boundaries rather than ambiguous labels', () => {
    expect(severity(4.9).label).toBe('Low');
    expect(severity(5).label).toBe('Moderate');
    expect(severity(7.9).label).toBe('Moderate');
    expect(severity(8).label).toBe('Severe');
    expect(severity(11).label).toBe('Severe');
    expect(severity(11.1).label).toBe('Critical');
  });
});
