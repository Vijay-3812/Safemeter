import type { Incident, Status, VehicleType } from './types';
import { corridors } from './geo/corridors';
import { seededRandom } from './seed';
import { formatInTimeZone } from 'date-fns-tz';
const names = ['A. Karthik', 'S. Priya', 'M. Arjun', 'R. Nivetha', 'V. Suresh', 'D. Kavya'];
export function createIncident(
  index: number,
  time: number,
  random: () => number,
  status: Status = 'alerted',
): Incident {
  const zone = corridors[Math.floor(random() * corridors.length)];
  const segment = Math.floor(random() * (zone.points.length - 1));
  const a = zone.points[segment],
    b = zone.points[segment + 1];
  const t = random();
  const speed = Math.round(24 + random() * 61);
  const impact = +(2.4 + speed * 0.105 + (random() - 0.5) * 4).toFixed(1);
  const accepted = ['responder_assigned', 'responder_arrived', 'closed'].includes(status);
  const arrived = ['responder_arrived', 'closed'].includes(status);
  const acceptTime = accepted ? time + Math.round(24 + random() * 140) * 1000 : null;
  const arriveTime = arrived ? acceptTime! + Math.round(150 + random() * 510) * 1000 : null;
  const lat = a[1] + (b[1] - a[1]) * t,
    lng = a[0] + (b[0] - a[0]) * t;
  return {
    id: `INC-${formatInTimeZone(time, 'Asia/Kolkata', 'yyyy-MMdd')}-${String(index + 1).padStart(4, '0')}`,
    vehicle: `TN-${['09', '07', '11', '22'][index % 4]}-${['BX', 'CR', 'DM', 'AE'][index % 4]}-${Math.floor(1000 + random() * 8999)}`,
    vehicleType: (['Two-wheeler', 'Car', 'Two-wheeler', 'Auto', 'Truck'] as VehicleType[])[
      index % 5
    ],
    time,
    speed,
    impact,
    status,
    lat,
    lng,
    zone: zone.name,
    landmark: zone.landmark,
    acceptTime,
    arriveTime,
    cancelledTime: status === 'cancelled' ? time + 15000 : undefined,
    closedTime: status === 'closed' ? arriveTime! + 120000 : null,
    responder: accepted
      ? {
          id: `R-${String((index % 6) + 1).padStart(2, '0')}`,
          name: names[index % 6],
          lat: lat - 0.009,
          lng: lng - 0.006,
          eta: Math.round(3 + random() * 6),
          distance: +(1.2 + random() * 2).toFixed(1),
        }
      : null,
  };
}
/** Generate rush-hour-weighted history, then reserve recent, unattended incidents. */
export function generateIncidents(seed = 20261023, now = Date.now()): Incident[] {
  const random = seededRandom(seed);
  const statuses: Status[] = [
    'alerted',
    'responder_assigned',
    'responder_arrived',
    'closed',
    'closed',
    'cancelled',
  ];
  return Array.from({ length: 123 }, (_, i) => {
    const day = Math.floor(i / 41);
    let offset: number;
    if (i < 7) offset = (1 + i * 2) * 60000;
    else {
      let candidate = now - (day * 24 + 1 + random() * 20) * 3600000;
      for (let attempt = 0; attempt < 8; attempt++) {
        const h = Number(formatInTimeZone(candidate, 'Asia/Kolkata', 'H'));
        if ([8, 9, 10, 17, 18, 19, 22, 23].includes(h)) break;
        candidate = now - (day * 24 + 1 + random() * 20) * 3600000;
      }
      offset = now - candidate;
    }
    return createIncident(
      i,
      now - offset,
      random,
      i < 7 ? 'alerted' : statuses[i % statuses.length],
    );
  }).sort((a, b) => b.time - a.time);
}
export function progressIncident(incident: Incident, now: number): Incident {
  if (incident.status === 'alerted')
    return {
      ...incident,
      status: 'responder_assigned',
      acceptTime: now,
      responder: {
        id: 'R-07',
        name: 'S. Meena',
        lat: incident.lat - 0.01,
        lng: incident.lng - 0.006,
        eta: 5,
        distance: 1.8,
      },
    };
  if (incident.status === 'responder_assigned')
    return { ...incident, status: 'responder_arrived', arriveTime: now };
  if (incident.status === 'responder_arrived')
    return { ...incident, status: 'closed', closedTime: now };
  return incident;
}
