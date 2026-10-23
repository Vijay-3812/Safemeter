import { useEffect } from 'react';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { Crosshair, Layers, Radio, Search, X } from 'lucide-react';
import { corridors } from '../../data/geo/corridors';
import { useDashboardStore } from '../../store/useDashboardStore';
import { Button, Pill } from '../ui';
export function CommandPalette() {
  const open = useDashboardStore((s) => s.commandOpen);
  const incidents = useDashboardStore((s) => s.incidents);
  const close = () => useDashboardStore.setState({ commandOpen: false });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useDashboardStore.setState((s) => ({ commandOpen: !s.commandOpen }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => useDashboardStore.setState({ commandOpen: v })}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="command-dialog">
          <Dialog.Title className="sr-only">Search SafeMeter</Dialog.Title>
          <Dialog.Description className="sr-only">
            Find an incident, jump to a road corridor or toggle a map layer.
          </Dialog.Description>
          <Command label="Search incidents, zones and layers">
            <div className="command-input">
              <Search size={18} />
              <Command.Input autoFocus placeholder="Search incidents, vehicles, zones…" />
              <Dialog.Close asChild>
                <Button variant="ghost" aria-label="Close search">
                  <X size={16} />
                </Button>
              </Dialog.Close>
            </div>
            <Command.List>
              <Command.Empty>No matches. Try a vehicle registration or “heatmap”.</Command.Empty>
              <Command.Group heading="Incidents">
                {incidents.map((i) => (
                  <Command.Item
                    key={i.id}
                    value={`${i.id} ${i.vehicle} ${i.zone}`}
                    onSelect={() => {
                      useDashboardStore.getState().select(i.id);
                      close();
                    }}
                  >
                    <Radio size={15} />
                    <span>
                      {i.vehicle}
                      <small>{i.zone}</small>
                    </span>
                    <Pill status={i.status} />
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Road corridors">
                {corridors.map((c) => (
                  <Command.Item
                    key={c.name}
                    onSelect={() => {
                      useDashboardStore.setState((s) => ({
                        focusZone: c.name,
                        layers: { ...s.layers, heatmap: true },
                      }));
                      document.getElementById('map')?.scrollIntoView();
                      close();
                    }}
                  >
                    <Crosshair size={15} />
                    {c.name}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Map layers">
                {(['incidents', 'heatmap', 'responders', 'coverage'] as const).map((key) => (
                  <Command.Item
                    key={key}
                    value={`Toggle ${key}`}
                    onSelect={() => {
                      useDashboardStore.getState().toggleLayer(key);
                      close();
                    }}
                  >
                    <Layers size={15} />
                    Toggle {key}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="command-footer">
              <span>↑ ↓ Navigate</span>
              <span>↵ Open</span>
              <span>Esc Close</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
