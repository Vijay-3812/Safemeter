import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCheck,
  Copy,
  Download,
  MapPin,
  Navigation,
  Phone,
  Radio,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { absoluteTime, clock, duration } from '../../lib/format';
import { severity } from '../../lib/severity';
import { Badge, Button, Pill, Tooltip } from '../../components/ui';
import { SLA } from '../../lib/sla';
export default function IncidentDrawer() {
  const selected = useDashboardStore((s) => s.selected);
  const incidents = useDashboardStore((s) => s.incidents);
  const now = useDashboardStore((s) => s.now);
  const incident = incidents.find((i) => i.id === selected);
  const [copied, setCopied] = useState(false);
  const exportReport = () => {
    if (!incident) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { notice: 'SIMULATED DATA — no real emergency service contacted', ...incident },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${incident.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    if (!incident) return;
    try {
      await navigator.clipboard.writeText(`${incident.lat.toFixed(6)}, ${incident.lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      useDashboardStore
        .getState()
        .notify('Clipboard unavailable. Coordinates are displayed for manual copying.');
    }
  };
  return (
    <Dialog.Root
      open={!!incident}
      onOpenChange={(v) => {
        if (!v) useDashboardStore.getState().select(null);
      }}
    >
      <AnimatePresence>
        {incident && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="dialog-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                className="incident-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div className="drawer-header">
                  <div>
                    <span className="micro">INCIDENT DETAILS</span>
                    <Dialog.Title className="mono">{incident.id}</Dialog.Title>
                  </div>
                  <Tooltip label="Close incident details">
                    <Dialog.Close asChild>
                      <Button
                        variant="ghost"
                        className="icon-button"
                        aria-label="Close incident details"
                      >
                        <X size={19} />
                      </Button>
                    </Dialog.Close>
                  </Tooltip>
                </div>
                <Dialog.Description className="drawer-description">
                  Simulated incident · Chennai operations
                </Dialog.Description>
                <div className="drawer-badges">
                  <Pill status={incident.status} />
                  <Tooltip label="Prototype impact categories, not an assessment of injury severity.">
                    <span
                      tabIndex={0}
                      className="severity-badge"
                      style={{ color: severity(incident.impact).color }}
                    >
                      <AlertTriangle size={12} />
                      {severity(incident.impact).label} impact
                    </span>
                  </Tooltip>
                  {incident.escalated && <Badge>Escalated locally</Badge>}
                </div>
                <div className="drawer-body">
                  <div
                    className="drawer-minimap"
                    aria-label={`Schematic location near ${incident.zone}`}
                  >
                    <svg
                      viewBox="0 0 440 130"
                      role="img"
                      aria-label="Illustrative location schematic, not a navigation map"
                    >
                      <path
                        className="mini-road"
                        d="M-10 80 130 75 220 45 450 30 M90-10 120 150 M300-10 270 150 M-10 15 450 115"
                      />
                      <path className="mini-route" d="M95 110 120 75 220 45" />
                      <circle cx="220" cy="45" r="16" className="mini-pin-ring" />
                      <circle cx="220" cy="45" r="5" className="mini-pin" />
                    </svg>
                    <span>
                      <MapPin size={12} />
                      {incident.zone}
                    </span>
                    <small>Location schematic</small>
                  </div>
                  <div className="location-block">
                    <strong>{incident.landmark}</strong>
                    <p>Corridor label from demo dataset · not reverse-geocoded</p>
                    <div>
                      <code>
                        {incident.lat.toFixed(6)}, {incident.lng.toFixed(6)}
                      </code>
                      <Tooltip label="Copy coordinates">
                        <Button
                          aria-label="Copy incident coordinates"
                          variant="ghost"
                          onClick={() => void copy()}
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                        </Button>
                      </Tooltip>
                      <a
                        className="text-link"
                        href={`https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lng}#map=15/${incident.lat}/${incident.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open map
                        <ArrowUpRight size={12} />
                      </a>
                    </div>
                  </div>
                  <Tabs.Root defaultValue="response">
                    <Tabs.List className="drawer-tabs" aria-label="Incident detail sections">
                      <Tabs.Trigger value="response">Response</Tabs.Trigger>
                      <Tabs.Trigger value="telemetry">Telemetry</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="response">
                      <h3 className="drawer-section-title">Response timeline</h3>
                      <ol className="response-timeline">
                        {[
                          { label: 'Alert raised', time: incident.time, icon: Radio },
                          {
                            label: 'Responder accepted',
                            time: incident.acceptTime,
                            icon: ShieldCheck,
                          },
                          { label: 'En route', time: incident.acceptTime, icon: Truck },
                          { label: 'Arrived at scene', time: incident.arriveTime, icon: MapPin },
                          {
                            label:
                              incident.status === 'cancelled'
                                ? 'Cancelled · false alarm'
                                : 'Case closed',
                            time:
                              incident.status === 'cancelled'
                                ? (incident.cancelledTime ?? null)
                                : incident.closedTime,
                            icon: CheckCheck,
                          },
                        ].map((step, index, steps) => {
                          const elapsed =
                            step.time && index > 0 && steps[index - 1].time
                              ? (step.time - steps[index - 1].time!) / 1000
                              : null;
                          const breach =
                            index === 1 && step.time
                              ? (step.time - incident.time) / 1000 > SLA.accept
                              : index === 3 && step.time
                                ? (step.time - incident.time) / 1000 > SLA.arrive
                                : false;
                          return (
                            <li key={step.label} className={step.time ? 'complete' : ''}>
                              <span className="timeline-node">
                                <step.icon size={14} />
                              </span>
                              <div>
                                <strong>{step.label}</strong>
                                <span>
                                  {step.time ? (
                                    <Tooltip label={absoluteTime(step.time)}>
                                      <time tabIndex={0}>{clock(step.time)} IST</time>
                                    </Tooltip>
                                  ) : (
                                    'Pending'
                                  )}
                                  {elapsed !== null && elapsed > 0 && (
                                    <small>+{duration(elapsed)}</small>
                                  )}
                                  {breach && <em>SLA exceeded</em>}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                      <div className="responder-card">
                        <div className="responder-avatar">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <span className="micro">ASSIGNED RESPONDER</span>
                          <strong>{incident.responder?.name ?? 'Awaiting assignment'}</strong>
                          <p>
                            {incident.responder
                              ? `${incident.responder.id} · ${incident.responder.distance} km · ${incident.responder.eta}m demo ETA`
                              : 'Assign a simulated unit to explore the response flow.'}
                          </p>
                          {incident.responder && (
                            <span className="masked">
                              <Phone size={11} />
                              +91 ••••• ••482
                            </span>
                          )}
                        </div>
                      </div>
                    </Tabs.Content>
                    <Tabs.Content value="telemetry">
                      <div className="telemetry-grid">
                        <div>
                          <span className="micro">SPEED BEFORE IMPACT</span>
                          <strong>
                            {incident.speed}
                            <small> km/h</small>
                          </strong>
                        </div>
                        <div>
                          <span className="micro">PEAK IMPACT</span>
                          <strong style={{ color: severity(incident.impact).color }}>
                            {incident.impact.toFixed(1)}
                            <small> g</small>
                          </strong>
                        </div>
                      </div>
                      <div className="telemetry-chart">
                        <div className="micro">ILLUSTRATIVE PRE-IMPACT SPEED</div>
                        <svg
                          viewBox="0 0 400 130"
                          role="img"
                          aria-label="Simulated speed trace, showing a sudden decrease near impact"
                        >
                          <path className="trace-grid" d="M0 20H400M0 60H400M0 100H400" />
                          <path
                            className="trace-fill"
                            d="M0 25 40 22 80 27 120 20 160 25 200 23 245 28 265 60 285 110 340 115 400 117V130H0Z"
                          />
                          <path
                            className="trace-line"
                            d="M0 25 40 22 80 27 120 20 160 25 200 23 245 28 265 60 285 110 340 115 400 117"
                          />
                        </svg>
                        <div>
                          <span>−10 seconds</span>
                          <span>Impact →</span>
                        </div>
                      </div>
                      <p className="muted">
                        This trace illustrates deceleration; it is not a sensor recording. Display
                        thresholds: low &lt;5g, moderate 5–8g, severe 8–11g, critical &gt;11g.
                      </p>
                    </Tabs.Content>
                  </Tabs.Root>
                  <div className="vehicle-card">
                    <span className="micro">VEHICLE INFORMATION</span>
                    <strong className="mono">{incident.vehicle}</strong>
                    <span>{incident.vehicleType} · Demo owner A. K.</span>
                    <span className="masked">
                      <Phone size={12} />
                      Emergency contact +91 ••••• ••219
                    </span>
                  </div>
                  <div className="drawer-elapsed">
                    <Navigation size={13} />
                    Raised {duration((now - incident.time) / 1000)} ago · timestamps in IST
                  </div>
                </div>
                <div className="drawer-actions">
                  {incident.status === 'alerted' ? (
                    <Button
                      variant="primary"
                      onClick={() => useDashboardStore.getState().action(incident.id, 'assign')}
                    >
                      <ShieldCheck size={15} />
                      Assign demo responder
                    </Button>
                  ) : ['responder_assigned', 'responder_arrived'].includes(incident.status) ? (
                    <Button
                      variant="primary"
                      onClick={() => useDashboardStore.getState().action(incident.id, 'advance')}
                    >
                      <CheckCheck size={15} />
                      {incident.status === 'responder_assigned' ? 'Mark arrived' : 'Close incident'}
                    </Button>
                  ) : (
                    <Button variant="primary" disabled>
                      Incident {incident.status}
                    </Button>
                  )}
                  <Button
                    onClick={() => useDashboardStore.getState().action(incident.id, 'escalate')}
                    disabled={
                      incident.escalated || ['cancelled', 'closed'].includes(incident.status)
                    }
                  >
                    <ArrowUpRight size={15} />
                    Escalate locally
                  </Button>
                  <Button
                    variant="danger"
                    disabled={incident.status !== 'alerted'}
                    onClick={() => useDashboardStore.getState().action(incident.id, 'cancel')}
                  >
                    Mark false alarm
                  </Button>
                  <Button onClick={exportReport}>
                    <Download size={14} />
                    Export report
                  </Button>
                  <p>Demo actions only. No responder or emergency service is contacted.</p>
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
