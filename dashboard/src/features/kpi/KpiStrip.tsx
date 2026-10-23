import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, CircleHelp } from 'lucide-react';
import type { Incident, StatusFilter } from '../../data/types';
import { average, duration } from '../../lib/format';
import { SLA } from '../../lib/sla';
import { metrics, rangeMs, useDashboardStore } from '../../store/useDashboardStore';
import { Skeleton, Tooltip } from '../../components/ui';
function Count({ value, time = false }: { value: number; time?: boolean }) {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const control = animate(0, value, {
      duration: reduce ? 0 : 0.65,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => control.stop();
  }, [value, reduce]);
  return <>{time ? duration(display) : display}</>;
}
export function KpiStrip({ rows, previous }: { rows: Incident[]; previous: Incident[] }) {
  const loading = useDashboardStore((s) => s.loading);
  const status = useDashboardStore((s) => s.filters.status);
  const range = useDashboardStore((s) => s.filters.range);
  const current = metrics(rows),
    past = metrics(previous);
  const cards = [
    {
      title: 'Total incidents',
      value: current.total,
      old: past.total,
      filter: 'all',
      note: 'Across the selected window',
      goodDown: true,
    },
    {
      title: 'Awaiting response',
      value: current.counts.alerted,
      old: past.counts.alerted,
      filter: 'alerted',
      note: 'Unattended · needs attention',
      goodDown: true,
    },
    {
      title: 'False alarms',
      value: current.counts.cancelled,
      old: past.counts.cancelled,
      filter: 'cancelled',
      note: 'Cancelled before response',
      goodDown: true,
    },
    {
      title: 'Responders assigned',
      value: current.counts.responder_assigned,
      old: past.counts.responder_assigned,
      filter: 'responder_assigned',
      note: 'Currently en route',
      goodDown: false,
    },
    {
      title: 'Avg. time to accept',
      value: current.accept,
      old: past.accept,
      filter: 'all',
      note: 'Target ≤ 2m',
      goodDown: true,
      time: true,
      target: SLA.accept,
    },
    {
      title: 'Avg. time to arrive',
      value: current.arrive,
      old: past.arrive,
      filter: 'all',
      note: 'Target ≤ 8m',
      goodDown: true,
      time: true,
      target: SLA.arrive,
    },
  ];
  return (
    <section className="kpi-strip" aria-label="Incident performance indicators">
      {cards.map((card, index) => {
        const delta =
          card.old && card.value !== null
            ? Math.round(((card.value - card.old) / card.old) * 100)
            : null;
        const good = delta !== null && (card.goodDown ? delta <= 0 : delta >= 0);
        const bins = Array.from({ length: 7 }, (_, k) => {
          const bucket = rows.filter(
            (i) =>
              Math.min(6, Math.floor(((Date.now() - i.time) / rangeMs(range)) * 7)) === 6 - k &&
              (card.filter === 'all' || i.status === card.filter),
          );
          if (!card.time) return bucket.length;
          const values = bucket.flatMap((i) => {
            const time = index === 4 ? i.acceptTime : i.arriveTime;
            return time === null ? [] : [(time - i.time) / 1000];
          });
          return average(values) ?? 0;
        });
        const max = Math.max(1, ...bins);
        const path = bins.map((v, k) => `${k * 12},${26 - (v / max) * 22}`).join(' ');
        return (
          <button
            key={card.title}
            className={`kpi-card ${index === 1 && card.value ? 'urgent' : ''} ${status === card.filter && card.filter !== 'all' ? 'filtered' : ''}`}
            onClick={() =>
              useDashboardStore.getState().setFilter({ status: card.filter as StatusFilter })
            }
            title={`Filter incidents: ${card.title}`}
          >
            <div className="kpi-label">
              {index === 1 && !!card.value && <span className="attention-dot" />}
              {card.title}
            </div>
            {loading ? (
              <Skeleton className="kpi-skeleton" />
            ) : (
              <div className="kpi-value">
                {card.value === null ? '—' : <Count value={card.value} time={card.time} />}
              </div>
            )}
            <div className="kpi-trend">
              {delta !== null ? (
                <>
                  <span className={good ? 'delta good' : 'delta bad'}>
                    {delta <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{' '}
                    {Math.abs(delta)}%
                  </span>
                  <span>vs previous period</span>
                </>
              ) : (
                <span>No prior-period baseline</span>
              )}
            </div>
            <div className="kpi-bottom">
              <span>{card.note}</span>
              {!card.time && (
                <svg className="sparkline" viewBox="0 0 74 28" aria-hidden="true">
                  <polyline
                    points={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            {card.target && (
              <div className="sla-track">
                <span
                  className={card.value && card.value > card.target ? 'sla-breached' : ''}
                  style={{ width: `${Math.min(100, ((card.value ?? 0) / card.target) * 100)}%` }}
                />
              </div>
            )}
          </button>
        );
      })}
      <div className="kpi-caption">
        <Tooltip label="All six cards use the same filtered incident set as the map, table and analytics. Deltas compare the preceding equal-length window. Targets are illustrative demo SLAs.">
          <span tabIndex={0}>
            <CircleHelp size={12} /> Shared filters · comparison with previous period
          </span>
        </Tooltip>
      </div>
    </section>
  );
}
