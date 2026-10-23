import { lazy, Suspense, useEffect, useMemo } from 'react';
import { MotionConfig } from 'motion/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ArrowUpRight, ChevronRight, MapPin, Pause, ShieldCheck } from 'lucide-react';
import { incidentSource } from './data/source';
import { filterRows, selectPeriod, useDashboardStore } from './store/useDashboardStore';
import { NavRail } from './components/layout/NavRail';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';
import { Badge, Button, Skeleton, Toasts } from './components/ui';
import { KpiStrip } from './features/kpi/KpiStrip';
import IncidentTable from './features/incidents/IncidentTable';
import IncidentDrawer from './features/incidents/IncidentDrawer';
const IncidentMap = lazy(() => import('./features/map/IncidentMap'));
const Analytics = lazy(() => import('./features/analytics/Analytics'));
function chime() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 580;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => void context.close();
  } catch {
    /* Browser autoplay restrictions: the visual toast remains available. */
  }
}
export default function App() {
  const incidents = useDashboardStore((s) => s.incidents);
  const filters = useDashboardStore((s) => s.filters);
  const now = useDashboardStore((s) => s.now);
  const error = useDashboardStore((s) => s.error);
  const paused = useDashboardStore((s) => s.paused);
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    incidentSource
      .getIncidents()
      .then((rows) => {
        if (disposed) return;
        useDashboardStore.getState().setIncidents(rows);
        unsubscribe = incidentSource.subscribe((incoming) => {
          const state = useDashboardStore.getState();
          if (state.paused) return;
          const existing = new Set(state.incidents.map((i) => i.id));
          const fresh = incoming.find((i) => !existing.has(i.id));
          state.setIncidents(incoming);
          if (fresh) {
            state.notify(
              `${fresh.impact > 11 ? 'Critical impact' : 'New incident'} ${fresh.impact.toFixed(1)}g · ${fresh.zone}`,
              fresh.id,
            );
            if (fresh.impact > 11 && !state.muted) chime();
          }
        });
      })
      .catch(() => {
        if (!disposed)
          useDashboardStore.setState({
            error: 'Unable to load the incident source. Check the connection and retry.',
            loading: false,
          });
      });
    const tick = setInterval(() => useDashboardStore.getState().tick(), 1000);
    return () => {
      disposed = true;
      unsubscribe();
      clearInterval(tick);
    };
  }, []);
  const windowEnd = Math.ceil(now / 60000) * 60000;
  const period = useMemo(
    () => selectPeriod(incidents, filters, windowEnd),
    [incidents, filters, windowEnd],
  );
  const rows = useMemo(() => filterRows(period, filters), [period, filters]);
  const previous = useMemo(
    () => filterRows(selectPeriod(incidents, filters, windowEnd, true), filters),
    [incidents, filters, windowEnd],
  );
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider delayDuration={250}>
        <a className="skip-link" href="#main-content">
          Skip to console
        </a>
        <NavRail />
        <div className="app-shell">
          <TopBar />
          <main id="main-content">
            <div className="page-heading" id="overview">
              <div>
                <div className="breadcrumb">
                  <MapPin size={12} />
                  Tamil Nadu
                  <ChevronRight size={11} />
                  Chennai
                </div>
                <div className="page-title">
                  <h1>Response overview</h1>
                  <Badge>Demo data</Badge>
                </div>
                <p>A clear picture of every incident. A faster path to response.</p>
              </div>
              <div className="heading-meta">
                <div>
                  <span className="region-dot" />
                  Chennai metro <span className="muted">/</span> IST
                </div>
                <span className="muted">
                  {paused ? (
                    <>
                      <Pause size={12} />
                      Simulation paused
                    </>
                  ) : (
                    <>Seed 20261023 · simulated updates every 20–40s</>
                  )}
                </span>
              </div>
            </div>
            {error && (
              <div className="error-banner" role="alert">
                {error}
                <Button onClick={() => location.reload()}>Retry</Button>
              </div>
            )}
            <KpiStrip rows={rows} previous={previous} />
            <div className="operations-grid">
              <Suspense fallback={<Skeleton className="map-loading" />}>
                <IncidentMap rows={rows} />
              </Suspense>
              <IncidentTable rows={rows} period={period} />
            </div>
            <div className="section-heading">
              <h2>Operational intelligence</h2>
              <span>Derived from the same filtered incident set</span>
            </div>
            <Suspense fallback={<Skeleton className="analytics-loading" />}>
              <Analytics rows={rows} />
            </Suspense>
            <footer className="app-footer">
              <span>
                <ShieldCheck size={13} />
                SafeMeter · Built for the moments that matter.
              </span>
              <span>
                Simulated data. No live emergency integrations.
                <a href="https://github.com/Vijay-3812/Safemeter" target="_blank" rel="noreferrer">
                  View project
                  <ArrowUpRight size={12} />
                </a>
              </span>
            </footer>
          </main>
        </div>
        <CommandPalette />
        <IncidentDrawer />
        <Toasts />
      </Tooltip.Provider>
    </MotionConfig>
  );
}
