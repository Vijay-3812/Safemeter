import type { Incident, Status } from './types';
import { createIncident, generateIncidents, progressIncident } from './simulation';
import { seededRandom } from './seed';
import { validCoordinate } from './geo/corridors';
export interface IncidentSource {
  getIncidents(): Promise<Incident[]>;
  subscribe(listener: (incidents: Incident[]) => void): () => void;
}
export class SimulatedSource implements IncidentSource {
  private incidents: Incident[];
  private random: () => number;
  constructor(seed = 20261023, now = Date.now()) {
    this.incidents = generateIncidents(seed, now);
    this.random = seededRandom(seed + 1);
  }
  async getIncidents() {
    return this.incidents;
  }
  subscribe(listener: (incidents: Incident[]) => void) {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = () => {
      timer = setTimeout(
        () => {
          if (stopped) return;
          const candidate = this.incidents.find((i) => !['cancelled', 'closed'].includes(i.status));
          if (this.random() > 0.45 || !candidate)
            this.incidents = [
              createIncident(this.incidents.length, Date.now(), this.random),
              ...this.incidents,
            ];
          else
            this.incidents = this.incidents.map((i) =>
              i.id === candidate.id ? progressIncident(i, Date.now()) : i,
            );
          listener([...this.incidents]);
          tick();
        },
        20000 + Math.round(this.random() * 20000),
      );
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }
}
type Legacy = Record<string, unknown>;
const numberTime = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === 'object' && v && 'seconds' in v)
    return Number((v as { seconds: number }).seconds) * 1000;
  if (v instanceof Date) return v.getTime();
  const n = typeof v === 'number' ? v : Date.parse(String(v));
  return Number.isFinite(n) ? n : null;
};
/** Adapter for the original Firebase shape and the normalized API shape. */
export function adaptIncident(raw: Legacy): Incident {
  const time = numberTime(raw.time ?? raw.createdAt);
  if (time === null) throw new Error('Incident timestamp is invalid');
  const status = String(raw.status) as Status;
  if (
    !['alerted', 'responder_assigned', 'responder_arrived', 'closed', 'cancelled'].includes(status)
  )
    throw new Error('Unknown incident status');
  const lat = Number(raw.lat),
    lng = Number(raw.lng ?? raw.lon);
  if (!validCoordinate(lat, lng)) throw new Error('Incident outside Chennai bounds');
  const accepted = ['responder_assigned', 'responder_arrived', 'closed'].includes(status);
  const arrived = ['responder_arrived', 'closed'].includes(status);
  const acceptTime = accepted
    ? (numberTime(raw.acceptTime) ??
      (raw.timeToAcceptSec != null ? time + Number(raw.timeToAcceptSec) * 1000 : null))
    : null;
  const arriveTime = arrived
    ? (numberTime(raw.arriveTime) ??
      (raw.timeToArriveSec != null ? time + Number(raw.timeToArriveSec) * 1000 : null))
    : null;
  const speed = Number(raw.speed ?? raw.speedKmh),
    impact = Number(raw.impact ?? raw.peakG);
  if (!Number.isFinite(speed) || !Number.isFinite(impact) || speed < 0 || impact < 0)
    throw new Error('Invalid telemetry');
  if (
    (acceptTime !== null && acceptTime < time) ||
    (arriveTime !== null && (acceptTime === null || arriveTime < acceptTime))
  )
    throw new Error('Inconsistent response timestamps');
  return {
    id: String(raw.id),
    vehicle: String(raw.vehicle ?? raw.vehicleId ?? 'Unknown'),
    vehicleType: (raw.vehicleType ?? 'Car') as Incident['vehicleType'],
    time,
    speed,
    impact,
    status,
    lat,
    lng,
    zone: String(raw.zone ?? 'Chennai'),
    landmark: String(raw.landmark ?? 'Location provided by device'),
    acceptTime,
    arriveTime,
    closedTime: status === 'closed' ? numberTime(raw.closedTime) : null,
    cancelledTime: numberTime(raw.cancelledTime) ?? undefined,
    responder: (raw.responder ?? null) as Incident['responder'],
  };
}
/** Backend contract only: no server is bundled; endpoint must enforce auth/access controls. */
export class ApiSource implements IncidentSource {
  constructor(
    private base = '/api/incidents',
    private socketUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/incidents/stream`,
  ) {}
  async getIncidents() {
    const response = await fetch(this.base);
    if (!response.ok) throw new Error(`Incident API: ${response.status}`);
    const rows: Legacy[] = await response.json();
    return rows.map(adaptIncident);
  }
  subscribe(listener: (incidents: Incident[]) => void) {
    const ws = new WebSocket(this.socketUrl);
    ws.onmessage = (e) => {
      try {
        const rows: Legacy[] = JSON.parse(String(e.data));
        listener(rows.map(adaptIncident));
      } catch {
        /* Reject malformed snapshots; retain last known state. */
      }
    };
    return () => ws.close();
  }
}
export const incidentSource: IncidentSource = new SimulatedSource(); // Switch this one line to new ApiSource().
