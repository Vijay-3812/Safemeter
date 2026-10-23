import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Popover from '@radix-ui/react-popover';
import {
  Bell,
  ChevronDown,
  Command,
  Pause,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button, Switch, Tooltip } from '../ui';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { TimeRange } from '../../data/types';
export function TopBar() {
  const filters = useDashboardStore((s) => s.filters);
  const now = useDashboardStore((s) => s.now);
  const updated = useDashboardStore((s) => s.updatedAt);
  const paused = useDashboardStore((s) => s.paused);
  const muted = useDashboardStore((s) => s.muted);
  const toasts = useDashboardStore((s) => s.toasts);
  return (
    <header className="topbar">
      <div className="wordmark">
        <ShieldCheck className="mobile-mark" size={26} />
        <div>
          <strong>
            SafeMeter<span className="brand-period">.</span>
          </strong>
          <span>Operations Console</span>
        </div>
      </div>
      <div className="top-divider" />
      <span className="top-page">Overview</span>
      <button
        className="command-trigger"
        onClick={() => useDashboardStore.setState({ commandOpen: true })}
      >
        <Search size={15} />
        <span>Search incidents, vehicles…</span>
        <kbd>
          <Command size={11} /> K
        </kbd>
      </button>
      <ToggleGroup.Root
        className="range-control"
        type="single"
        value={filters.range}
        onValueChange={(value) =>
          value && useDashboardStore.getState().setFilter({ range: value as TimeRange })
        }
        aria-label="Time range"
      >
        {(['live', '24h', '7d', '30d'] as const).map((value) => (
          <ToggleGroup.Item key={value} value={value}>
            {value === 'live' ? 'Live' : value}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <div className="live-indicator">
        <span className={paused ? 'live-dot paused' : 'live-dot'} />
        <span>
          {paused ? 'Paused' : 'Live'}
          <small>updated {Math.max(0, Math.floor((now - updated) / 1000))}s ago</small>
        </span>
      </div>
      <Popover.Root>
        <Tooltip label="Notifications">
          <Popover.Trigger asChild>
            <Button
              className="icon-button notification-button"
              variant="ghost"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {toasts.length > 0 && <i />}
            </Button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content align="end" className="popover notification-panel" sideOffset={12}>
            <h3>Activity inbox</h3>
            <p className="muted">Simulation updates, never real emergency alerts.</p>
            {toasts.length ? (
              toasts.map((t) => (
                <button
                  key={t.id}
                  className="notification-row"
                  onClick={() => {
                    if (t.incidentId) useDashboardStore.getState().select(t.incidentId);
                  }}
                >
                  {t.message}
                </button>
              ))
            ) : (
              <p className="empty-small">You’re up to date. New demo activity appears here.</p>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="user-menu" aria-label="AK · Dispatcher menu">
            <span className="avatar">AK</span>
            <ChevronDown size={12} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" className="popover profile-panel" sideOffset={12}>
            <strong>A. Karthik</strong>
            <p className="muted">Demo dispatcher · Chennai</p>
            <div className="menu-separator" />
            <span className="micro">LOCAL SIMULATION SESSION</span>
            <p>No account or external dispatch service is connected.</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Popover.Root>
        <Tooltip label="Console settings">
          <Popover.Trigger asChild>
            <Button
              id="settings-trigger"
              className="icon-button settings-button"
              variant="ghost"
              aria-label="Console settings"
            >
              <Settings2 size={17} />
            </Button>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content align="end" className="popover settings-panel" sideOffset={12}>
            <h3>Console preferences</h3>
            <label>
              {paused ? <Pause size={15} /> : <Play size={15} />} Live simulation
              <Switch
                label="Enable live simulation"
                checked={!paused}
                onCheckedChange={(v) => useDashboardStore.setState({ paused: !v })}
              />
            </label>
            <label>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />} Critical incident chime
              <Switch
                label="Enable critical incident sound"
                checked={!muted}
                onCheckedChange={(v) => useDashboardStore.setState({ muted: !v })}
              />
            </label>
            <p className="muted">
              Settings apply to this tab only. No operational alerts are sent.
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </header>
  );
}
