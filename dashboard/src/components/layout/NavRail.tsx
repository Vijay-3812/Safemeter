import {
  Activity,
  BarChart3,
  CircleHelp,
  Crosshair,
  LayoutDashboard,
  Map,
  Radio,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { Tooltip } from '../ui';
const items = [
  { label: 'Overview', icon: LayoutDashboard, target: 'overview' },
  { label: 'Live map', icon: Map, target: 'map' },
  { label: 'Incidents', icon: Radio, target: 'incidents' },
  { label: 'Responders', icon: Users, target: 'map' },
  { label: 'Analytics', icon: BarChart3, target: 'analytics' },
  { label: 'Black-spots', icon: Crosshair, target: 'analytics' },
  { label: 'Settings', icon: Settings2, target: 'settings' },
];
export function NavRail() {
  const nav = useDashboardStore((s) => s.nav);
  return (
    <nav className="nav-rail" aria-label="Main navigation">
      <a className="rail-brand" href="#overview" aria-label="SafeMeter overview">
        <ShieldCheck size={27} />
      </a>
      <div className="rail-items">
        {items.map(({ label, icon: Icon, target }) => (
          <Tooltip label={label} key={label}>
            <button
              className={`rail-item ${nav === label ? 'active' : ''}`}
              aria-label={label}
              aria-current={nav === label ? 'page' : undefined}
              onClick={() => {
                useDashboardStore.setState({ nav: label });
                if (label === 'Black-spots')
                  useDashboardStore.setState((s) => ({ layers: { ...s.layers, heatmap: true } }));
                if (label === 'Responders')
                  useDashboardStore.setState((s) => ({
                    layers: { ...s.layers, responders: true },
                  }));
                if (label === 'Settings') document.getElementById('settings-trigger')?.click();
                else
                  document.getElementById(target)?.scrollIntoView({
                    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  });
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span>{label}</span>
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="rail-bottom">
        <Tooltip label="Simulation running">
          <span className="rail-health">
            <Activity size={18} />
          </span>
        </Tooltip>
        <Tooltip label="Read dashboard documentation">
          <a
            className="rail-item"
            href="https://github.com/Vijay-3812/Safemeter/tree/main/dashboard"
            target="_blank"
            rel="noreferrer"
            aria-label="Dashboard documentation"
          >
            <CircleHelp size={20} />
          </a>
        </Tooltip>
      </div>
    </nav>
  );
}
