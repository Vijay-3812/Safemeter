export const STATUSES = [
  'alerted',
  'responder_assigned',
  'responder_arrived',
  'closed',
  'cancelled',
] as const;
export type Status = (typeof STATUSES)[number];
export type VehicleType = 'Two-wheeler' | 'Car' | 'Auto' | 'Truck';
export interface Responder {
  id: string;
  name: string;
  lat: number;
  lng: number;
  eta: number;
  distance: number;
}
export interface Incident {
  id: string;
  vehicle: string;
  vehicleType: VehicleType;
  time: number;
  speed: number;
  impact: number;
  status: Status;
  lat: number;
  lng: number;
  zone: string;
  landmark: string;
  acceptTime: number | null;
  arriveTime: number | null;
  closedTime: number | null;
  responder: Responder | null;
  escalated?: boolean;
  cancelledTime?: number;
}
export type TimeRange = 'live' | '24h' | '7d' | '30d';
export type StatusFilter = Status | 'all';
export interface Filters {
  status: StatusFilter;
  search: string;
  range: TimeRange;
  sort: 'newest' | 'severity' | 'oldest';
}
export interface Layers {
  incidents: boolean;
  heatmap: boolean;
  responders: boolean;
  coverage: boolean;
}
export interface ToastMessage {
  id: number;
  message: string;
  incidentId?: string;
}
