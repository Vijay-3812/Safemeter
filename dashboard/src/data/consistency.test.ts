import { describe, expect, it } from 'vitest';
import { generateIncidents, progressIncident } from './simulation';
import { adaptIncident } from './source';
import { checkConsistency, filterRows, metrics, selectPeriod } from '../store/useDashboardStore';
import { validCoordinate } from './geo/corridors';
import { STATUSES, type Filters } from './types';
const now = Date.UTC(2026, 9, 23, 12);
const incidents = generateIncidents(42, now);
describe('single-source data contract', () => {
  it('is deterministic for the same seed and clock', () =>
    expect(generateIncidents(42, now)).toEqual(incidents));
  it('keeps KPI total == sum of statuses == table rows across every filter', () => {
    for (const range of ['live', '24h', '7d', '30d'] as const)
      for (const status of ['all', ...STATUSES] as const) {
        const filters: Filters = { range, status, search: '', sort: 'newest' };
        const rows = filterRows(selectPeriod(incidents, filters, now), filters);
        expect(checkConsistency(rows)).toBe(true);
        expect(metrics(rows).total).toBe(rows.length);
      }
  });
  it('has 41 incidents in the initial 24h and plausible, ordered timestamps', () => {
    expect(
      selectPeriod(incidents, { range: 'live', status: 'all', search: '', sort: 'newest' }, now),
    ).toHaveLength(41);
    for (const i of incidents) {
      expect(validCoordinate(i.lat, i.lng)).toBe(true);
      if (i.acceptTime !== null) expect(i.acceptTime).toBeGreaterThanOrEqual(i.time);
      if (i.arriveTime !== null) expect(i.arriveTime).toBeGreaterThanOrEqual(i.acceptTime!);
      if (i.closedTime !== null) expect(i.closedTime).toBeGreaterThanOrEqual(i.arriveTime!);
      for (const t of [i.time, i.acceptTime, i.arriveTime, i.closedTime])
        if (t !== null) expect(t).toBeLessThanOrEqual(now);
      if (i.status === 'alerted') {
        expect(i.acceptTime).toBeNull();
        expect(i.arriveTime).toBeNull();
      }
      if (i.status === 'responder_assigned') expect(i.arriveTime).toBeNull();
    }
  });
  it('progresses a fresh alert without impossible lifecycle fields', () => {
    let i = incidents.find((i) => i.status === 'alerted')!;
    i = progressIncident(i, now);
    expect(i.status).toBe('responder_assigned');
    expect(i.arriveTime).toBeNull();
    i = progressIncident(i, now + 300000);
    expect(i.arriveTime).toBeGreaterThan(i.acceptTime!);
    expect(checkConsistency([i])).toBe(true);
  });
  it('adapts original Firebase names and rejects bad coordinates', () => {
    const i = adaptIncident({
      id: 'old',
      vehicleId: 'SM-001',
      createdAt: now - 1000000,
      speedKmh: 40,
      peakG: 6,
      status: 'responder_arrived',
      timeToAcceptSec: 30,
      timeToArriveSec: 400,
      lat: 13,
      lon: 80.2,
    });
    expect(i.vehicle).toBe('SM-001');
    expect(i.arriveTime! - i.time).toBe(400000);
    expect(() => adaptIncident({ ...i, lat: 0 })).toThrow();
  });
});
