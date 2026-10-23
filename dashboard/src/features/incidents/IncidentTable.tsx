import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as Select from '@radix-ui/react-select';
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  CircleX,
  Eye,
  Radio,
  Search,
  Truck,
  X,
} from 'lucide-react';
import type { Filters, Incident } from '../../data/types';
import { STATUSES } from '../../data/types';
import { filterRows, metrics, useDashboardStore } from '../../store/useDashboardStore';
import { absoluteTime, duration, relativeTime } from '../../lib/format';
import { severity, statusLabel } from '../../lib/severity';
import { Badge, Button, Pill, Skeleton, Tooltip } from '../../components/ui';
const helper = createColumnHelper<Incident>();
export default function IncidentTable({ rows, period }: { rows: Incident[]; period: Incident[] }) {
  const filters = useDashboardStore((s) => s.filters);
  const now = useDashboardStore((s) => s.now);
  const selected = useDashboardStore((s) => s.selected);
  const hovered = useDashboardStore((s) => s.hovered);
  const loading = useDashboardStore((s) => s.loading);
  const [search, setSearch] = useState(filters.search);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== useDashboardStore.getState().filters.search)
        useDashboardStore.getState().setFilter({ search });
    }, 180);
    return () => clearTimeout(id);
  }, [search]);
  const columns = useMemo(
    () => [
      helper.display({
        id: 'severity',
        header: () => null,
        cell: ({ row }) => (
          <Tooltip label={`${severity(row.original.impact).label} impact: ${row.original.impact}g`}>
            <span
              tabIndex={0}
              className="row-severity"
              style={{ background: severity(row.original.impact).color }}
            />
          </Tooltip>
        ),
      }),
      helper.accessor('vehicle', {
        header: 'Incident',
        cell: ({ row: r }) => (
          <div className="incident-ident">
            <Tooltip label={`${r.original.id} · ${r.original.vehicle} · ${r.original.vehicleType}`}>
              <strong tabIndex={0} className="mono">
                {r.original.vehicle}
              </strong>
            </Tooltip>
            <span className="incident-sub">
              {r.original.status === 'alerted' ? (
                <span className="unattended">
                  Unattended {duration((now - r.original.time) / 1000)}
                </span>
              ) : (
                <>
                  {r.original.vehicleType}
                  <span className="incident-short-id"> · {r.original.id.slice(-4)}</span>
                </>
              )}
            </span>
          </div>
        ),
      }),
      helper.accessor('time', {
        header: 'When',
        cell: ({ getValue }) => (
          <Tooltip label={absoluteTime(getValue())}>
            <span tabIndex={0} className="numeric muted">
              {relativeTime(getValue(), now)}
            </span>
          </Tooltip>
        ),
      }),
      helper.accessor('speed', {
        header: 'Speed',
        cell: ({ getValue }) => (
          <span className="numeric">
            {getValue()}
            <small> km/h</small>
          </span>
        ),
      }),
      helper.accessor('impact', {
        header: 'Impact',
        cell: ({ getValue }) => (
          <Tooltip
            label={`${severity(getValue()).label} · prototype display threshold, not an injury assessment`}
          >
            <span
              tabIndex={0}
              className="impact-value numeric"
              style={{ color: severity(getValue()).color }}
            >
              {getValue().toFixed(1)}
              <small> g</small>
              <i
                style={{
                  width: `${Math.min(100, (getValue() / 14) * 100)}%`,
                  background: severity(getValue()).color,
                }}
              />
            </span>
          </Tooltip>
        ),
      }),
      helper.accessor('status', {
        header: 'Status',
        cell: ({ getValue }) => <Pill status={getValue()} />,
      }),
      helper.accessor('acceptTime', {
        header: 'Accept',
        cell: ({ row, getValue }) => (
          <span className="numeric muted">
            {duration(getValue() === null ? null : (getValue()! - row.original.time) / 1000)}
          </span>
        ),
      }),
      helper.accessor('arriveTime', {
        header: 'Arrive',
        cell: ({ row, getValue }) => (
          <span className="numeric muted">
            {duration(getValue() === null ? null : (getValue()! - row.original.time) / 1000)}
          </span>
        ),
      }),
    ],
    [now],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });
  const tableRows = table.getRowModel().rows;
  const virtual = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 60,
    overscan: 8,
  });
  useEffect(() => {
    const index = rows.findIndex((i) => i.id === selected);
    if (index >= 0) virtual.scrollToIndex(index, { align: 'auto' });
  }, [selected, rows, virtual]);
  const searchable = filterRows(period, { ...filters, status: 'all' });
  const counts = metrics(searchable).counts;
  return (
    <section className="panel feed-panel" id="incidents" aria-label="Live incidents">
      <div className="panel-header">
        <div>
          <span className="section-dot alert-dot" />
          <h2>Live incidents</h2>
          <Badge>{rows.length}</Badge>
        </div>
        <Tooltip label="Demo updates every 20–40 seconds">
          <span className="feed-live">
            <Radio size={12} /> Live feed
          </span>
        </Tooltip>
      </div>
      <div className="feed-tools">
        <div className="input-wrap">
          <Search size={14} />
          <input
            aria-label="Search incident list"
            placeholder="Search vehicle, incident or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
        <Select.Root
          value={filters.sort}
          onValueChange={(v) =>
            useDashboardStore.getState().setFilter({ sort: v as Filters['sort'] })
          }
        >
          <Select.Trigger className="sort-trigger" aria-label="Sort incidents">
            <ArrowDownWideNarrow size={15} />
            <Select.Value />
            <ChevronDown size={12} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content className="select-content" position="popper" sideOffset={6}>
              <Select.Viewport>
                {[
                  ['newest', 'Newest first'],
                  ['severity', 'Highest impact'],
                  ['oldest', 'Oldest first'],
                ].map(([value, label]) => (
                  <Select.Item className="select-item" key={value} value={value}>
                    <Select.ItemText>{label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={13} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
      <div className="status-filters" role="group" aria-label="Filter incidents by status">
        {(['all', ...STATUSES] as const).map((status) => (
          <button
            key={status}
            className={filters.status === status ? 'active' : ''}
            aria-pressed={filters.status === status}
            onClick={() => useDashboardStore.getState().setFilter({ status })}
          >
            {status === 'all' ? 'All' : statusLabel[status]}
            <span>{status === 'all' ? searchable.length : counts[status]}</span>
          </button>
        ))}
      </div>
      <div
        className="incident-table"
        role="table"
        aria-label="Filtered incident records"
        aria-rowcount={rows.length + 1}
      >
        <div className="table-header table-grid" role="row">
          {table.getHeaderGroups()[0].headers.map((h) => (
            <div key={h.id} role="columnheader" className={`col-${h.column.id}`}>
              {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
              {h.column.id === 'time' && <span> ↓</span>}
            </div>
          ))}
        </div>
        <div ref={scroll} className="table-scroll" role="rowgroup">
          {loading ? (
            <div className="table-skeletons">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="table-skeleton" />
              ))}
            </div>
          ) : !tableRows.length ? (
            <div className="empty-state">
              <Search size={28} />
              <h3>No matching incidents</h3>
              <p>Try another vehicle, status or time range.</p>
              <Button
                onClick={() => {
                  setSearch('');
                  useDashboardStore.getState().setFilter({ search: '', status: 'all' });
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
              {virtual.getVirtualItems().map((item) => {
                const row = tableRows[item.index],
                  i = row.original;
                return (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    key={row.id}
                    role="row"
                    aria-rowindex={item.index + 2}
                    aria-selected={selected === i.id}
                    className={`incident-row table-grid ${selected === i.id ? 'selected' : ''} ${hovered === i.id ? 'hovered' : ''}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: 60,
                      transform: `translateY(${item.start}px)`,
                    }}
                    onMouseEnter={() => useDashboardStore.getState().hover(i.id)}
                    onMouseLeave={() => useDashboardStore.getState().hover(null)}
                    onClick={() => useDashboardStore.getState().select(i.id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        useDashboardStore.getState().select(i.id);
                      }
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const next = Math.max(
                          0,
                          Math.min(rows.length - 1, item.index + (e.key === 'ArrowDown' ? 1 : -1)),
                        );
                        virtual.scrollToIndex(next);
                        requestAnimationFrame(() =>
                          scroll.current
                            ?.querySelector<HTMLElement>(`[aria-rowindex="${next + 2}"]`)
                            ?.focus(),
                        );
                      }
                    }}
                    tabIndex={0}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div role="cell" key={cell.id} className={`col-${cell.column.id}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                    <div role="cell" className="row-actions">
                      {i.status === 'alerted' && (
                        <Tooltip label="Assign demo responder">
                          <Button
                            aria-label={`Assign responder to ${i.vehicle}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              useDashboardStore.getState().action(i.id, 'assign');
                            }}
                          >
                            <Truck size={13} />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip label="View incident">
                        <Button
                          aria-label={`View ${i.vehicle}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            useDashboardStore.getState().select(i.id);
                          }}
                        >
                          <Eye size={13} />
                        </Button>
                      </Tooltip>
                      {i.status === 'alerted' && (
                        <Tooltip label="Mark false alarm">
                          <Button
                            aria-label={`Mark ${i.vehicle} as false alarm`}
                            onClick={(e) => {
                              e.stopPropagation();
                              useDashboardStore.getState().action(i.id, 'cancel');
                            }}
                          >
                            <CircleX size={13} />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="feed-footer">
        <span>{rows.length} records · times in IST</span>
        <span>
          Click a row to investigate <span>↗</span>
        </span>
      </div>
    </section>
  );
}
