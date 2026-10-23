import { create } from 'zustand';
import type { Filters, Incident, Layers, StatusFilter, ToastMessage } from '../data/types';
import { STATUSES } from '../data/types';
import { average } from '../lib/format';
import { progressIncident } from '../data/simulation';
export interface DashboardState {
  incidents: Incident[];
  localOverrides: Record<string, Incident>;
  filters: Filters;
  layers: Layers;
  selected: string | null;
  hovered: string | null;
  now: number;
  loading: boolean;
  error: string | null;
  paused: boolean;
  muted: boolean;
  commandOpen: boolean;
  nav: string;
  toasts: ToastMessage[];
  focusZone: string | null;
  updatedAt: number;
  setIncidents: (rows: Incident[]) => void;
  setFilter: (filter: Partial<Filters>) => void;
  toggleLayer: (name: keyof Layers) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  tick: () => void;
  notify: (message: string, incidentId?: string) => void;
  dismiss: (id: number) => void;
  action: (id: string, action: 'assign' | 'cancel' | 'escalate' | 'advance') => void;
}
export const useDashboardStore = create<DashboardState>((set, get) => ({
  incidents: [],
  localOverrides: {},
  filters: { status: 'all', search: '', range: 'live', sort: 'newest' },
  layers: { incidents: true, heatmap: false, responders: true, coverage: false },
  selected: null,
  hovered: null,
  now: Date.now(),
  updatedAt: Date.now(),
  loading: true,
  error: null,
  paused: false,
  muted: true,
  commandOpen: false,
  nav: 'Overview',
  toasts: [],
  focusZone: null,
  setIncidents: (rows) =>
    set((s) => ({
      incidents: rows.map((i) => s.localOverrides[i.id] ?? i),
      loading: false,
      error: null,
      updatedAt: Date.now(),
    })),
  setFilter: (filter) => set((s) => ({ filters: { ...s.filters, ...filter } })),
  toggleLayer: (name) => set((s) => ({ layers: { ...s.layers, [name]: !s.layers[name] } })),
  select: (id) => set({ selected: id }),
  hover: (id) => set({ hovered: id }),
  tick: () => set({ now: Date.now() }),
  notify: (message, incidentId) =>
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id: Date.now(), message, incidentId }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  action: (id, action) => {
    const incident = get().incidents.find((i) => i.id === id);
    if (!incident) return;
    let next = incident;
    if (action === 'cancel')
      next = {
        ...incident,
        status: 'cancelled',
        cancelledTime: Date.now(),
        acceptTime: null,
        arriveTime: null,
        closedTime: null,
        responder: null,
      };
    if (action === 'escalate') next = { ...incident, escalated: true };
    if (action === 'assign' || action === 'advance') next = progressIncident(incident, Date.now());
    set((s) => ({
      incidents: s.incidents.map((i) => (i.id === id ? next : i)),
      localOverrides: { ...s.localOverrides, [id]: next },
    }));
    get().notify(
      action === 'escalate'
        ? 'Demo escalation recorded. No external service contacted.'
        : `Demo incident ${action === 'cancel' ? 'cancelled' : 'updated'}.`,
      id,
    );
  },
}));
export const rangeMs = (range: Filters['range']) =>
  (range === '7d' ? 7 : range === '30d' ? 30 : 1) * 86400000;
export function selectPeriod(
  incidents: Incident[],
  filters: Filters,
  now: number,
  previous = false,
) {
  const span = rangeMs(filters.range),
    end = now - (previous ? span : 0);
  return incidents.filter((i) => i.time <= end && i.time > end - span);
}
export function filterRows(rows: Incident[], filters: Filters) {
  const q = filters.search.trim().toLowerCase();
  return rows
    .filter(
      (i) =>
        (filters.status === 'all' || i.status === filters.status) &&
        (!q || `${i.id} ${i.vehicle} ${i.zone} ${i.vehicleType}`.toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      filters.sort === 'severity'
        ? b.impact - a.impact
        : filters.sort === 'oldest'
          ? a.time - b.time
          : b.time - a.time,
    );
}
export const selectVisible = (s: Pick<DashboardState, 'incidents' | 'filters' | 'now'>) =>
  filterRows(selectPeriod(s.incidents, s.filters, s.now), s.filters);
export function metrics(rows: Incident[]) {
  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, rows.filter((i) => i.status === status).length]),
  ) as Record<Exclude<StatusFilter, 'all'>, number>;
  return {
    total: rows.length,
    counts,
    accept: average(
      rows.filter((i) => i.acceptTime !== null).map((i) => (i.acceptTime! - i.time) / 1000),
    ),
    arrive: average(
      rows.filter((i) => i.arriveTime !== null).map((i) => (i.arriveTime! - i.time) / 1000),
    ),
  };
}
export function checkConsistency(rows: Incident[]) {
  return metrics(rows).total === Object.values(metrics(rows).counts).reduce((a, b) => a + b, 0);
}
