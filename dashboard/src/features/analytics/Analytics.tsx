import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { ArrowRight, ArrowUpRight, Crosshair } from 'lucide-react';
import type { Incident } from '../../data/types';
import { useDashboardStore } from '../../store/useDashboardStore';
import { average, duration } from '../../lib/format';
import { formatInTimeZone } from 'date-fns-tz';
import { Badge } from '../../components/ui';
import { SLA } from '../../lib/sla';
echarts.use([
  LineChart,
  BarChart,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  CanvasRenderer,
]);
let registered = false;
const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function Chart({ options, label }: { options: EChartsCoreOption; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (!registered) {
      echarts.registerTheme('safemeter', {
        color: [
          css('--accent'),
          css('--status-assigned'),
          css('--status-arrived'),
          css('--status-closed'),
        ],
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Geist Variable', color: css('--text-secondary'), fontSize: 12 },
        categoryAxis: {
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: css('--text-tertiary'), fontSize: 12 },
        },
        valueAxis: {
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: css('--text-tertiary'), fontSize: 12 },
          splitLine: { lineStyle: { color: css('--border') } },
        },
        tooltip: {
          backgroundColor: css('--bg-overlay'),
          borderColor: css('--border-active'),
          padding: 12,
          textStyle: { color: css('--text-primary'), fontSize: 12 },
          extraCssText: `border-radius:${css('--radius-md')};box-shadow:${css('--shadow-overlay')}`,
        },
      });
      registered = true;
    }
    const instance = echarts.init(ref.current, 'safemeter');
    instance.setOption({
      ...options,
      animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationDuration: 200,
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      instance.dispose();
    };
  }, [options]);
  return <div className="chart" ref={ref} role="img" aria-label={label} />;
}
export default function Analytics({ rows }: { rows: Incident[] }) {
  const now = useDashboardStore((s) => Math.floor(s.now / 3600000) * 3600000);
  const range = useDashboardStore((s) => s.filters.range);
  const seven = range === '7d' || range === '30d';
  const hour = Math.floor(now / 3600000) * 3600000;
  const area = useMemo(() => {
    const step = seven ? 86400000 : 3600000;
    const n = range === '30d' ? 30 : seven ? 7 : 24;
    const end = seven ? Math.floor(hour / 86400000) * 86400000 : hour;
    const values = Array.from({ length: n }, (_, k) => {
      const start = end - (n - 1 - k) * step;
      return {
        label: formatInTimeZone(start, 'Asia/Kolkata', seven ? 'EEE' : 'HH:mm'),
        value: rows.filter((i) => i.time >= start && i.time < start + step).length,
      };
    });
    const peak = Math.max(0, ...values.map((v) => v.value));
    return {
      values,
      peak,
      options: {
        grid: { top: 20, right: 10, bottom: 25, left: 26 },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: values.map((v) => v.label),
          boundaryGap: false,
          axisLabel: { interval: seven ? 0 : 5 },
        },
        yAxis: { type: 'value', minInterval: 1, splitNumber: 3 },
        series: [
          {
            type: 'line',
            data: values.map((v) => v.value),
            smooth: 0.3,
            symbol: 'none',
            lineStyle: { width: 2, color: css('--accent') },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: css('--accent-border') },
                { offset: 1, color: 'transparent' },
              ]),
            },
            markLine: peak
              ? {
                  silent: true,
                  symbol: 'none',
                  data: [{ yAxis: peak, name: 'Peak' }],
                  lineStyle: { color: css('--border-active'), type: 'dashed' },
                  label: { show: false },
                }
              : undefined,
          },
        ],
      },
    };
  }, [rows, seven, hour, range]);
  const arrive = rows
    .filter((i) => i.arriveTime !== null)
    .map((i) => (i.arriveTime! - i.time) / 1000)
    .sort((a, b) => a - b);
  const median = arrive.length ? arrive[Math.floor(arrive.length * 0.5)] : null;
  const p90 = arrive.length
    ? arrive[Math.min(arrive.length - 1, Math.ceil(arrive.length * 0.9) - 1)]
    : null;
  const histogram = useMemo(() => {
    const times = rows
      .filter((i) => i.arriveTime !== null)
      .map((i) => (i.arriveTime! - i.time) / 60 / 1000);
    return {
      grid: { top: 24, left: 24, right: 12, bottom: 25 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['0–2', '2–4', '4–6', '6–8', '8–10', '10–12', '12+'],
        axisLabel: { interval: 0 },
      },
      yAxis: { type: 'value', minInterval: 1, splitNumber: 2 },
      series: [
        {
          type: 'bar',
          barWidth: '60%',
          data: Array.from({ length: 7 }, (_, k) => ({
            value: times.filter((v) => (k === 6 ? v >= 12 : v >= k * 2 && v < (k + 1) * 2)).length,
            itemStyle: {
              color: k < 4 ? css('--accent') : css('--status-assigned'),
              opacity: 0.72,
              borderRadius: [3, 3, 0, 0],
            },
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: css('--status-assigned'), type: 'dashed' },
            label: { show: false },
            data: [{ xAxis: '8–10' }],
          },
        },
      ],
    };
  }, [rows]);
  const funnel = [
    { label: 'Raised', value: rows.filter((i) => i.status !== 'cancelled').length },
    { label: 'Accepted', value: rows.filter((i) => i.acceptTime !== null).length },
    { label: 'Arrived', value: rows.filter((i) => i.arriveTime !== null).length },
    { label: 'Closed', value: rows.filter((i) => i.status === 'closed').length },
  ];
  const cancelled = rows.filter((i) => i.status === 'cancelled').length;
  const zones = Array.from(new Set(rows.map((i) => i.zone)))
    .map((zone) => ({ zone, count: rows.filter((i) => i.zone === zone).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  return (
    <section className="analytics-grid" id="analytics" aria-label="Incident analytics">
      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <h2>Incidents over time</h2>
            <p>{seven ? 'Daily' : 'Hourly'} volume · IST</p>
          </div>
          <ToggleGroup.Root
            type="single"
            value={range === '30d' ? '30d' : seven ? '7d' : '24h'}
            className="chart-range"
            aria-label="Chart time range"
            onValueChange={(v) =>
              v && useDashboardStore.getState().setFilter({ range: v as '7d' | '24h' | '30d' })
            }
          >
            <ToggleGroup.Item value="24h">24h</ToggleGroup.Item>
            <ToggleGroup.Item value="7d">7d</ToggleGroup.Item>
            {range === '30d' && <ToggleGroup.Item value="30d">30d</ToggleGroup.Item>}
          </ToggleGroup.Root>
        </div>
        {rows.length ? (
          <Chart
            options={area.options}
            label={`Incident volume. ${rows.length} records in current view; peak bucket has ${area.peak} incidents.`}
          />
        ) : (
          <div className="chart-empty">No incident volume for this selection.</div>
        )}
        <div className="analytics-foot">
          <span className="accent-number">{rows.length}</span> in view
          <span className="push-right">
            Peak {area.peak} / {seven ? 'day' : 'hour'}
          </span>
        </div>
      </article>
      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <h2>Response funnel</h2>
            <p>Progress from detection to resolution</p>
          </div>
          <Badge>
            {rows.length ? Math.round((cancelled / rows.length) * 100) : 0}% false alarms
          </Badge>
        </div>
        <div className="funnel">
          {funnel.map((step, k) => {
            const previous = k ? funnel[k - 1].value : step.value;
            return (
              <div key={step.label} className="funnel-row">
                <span>{step.label}</span>
                <div>
                  <i
                    style={{
                      width: `${(step.value / Math.max(1, funnel[0].value)) * 100}%`,
                      opacity: 1 - k * 0.18,
                    }}
                  />
                </div>
                <strong>{step.value}</strong>
                <small>
                  {k ? `${previous ? Math.round((step.value / previous) * 100) : 0}%` : '100%'}
                </small>
              </div>
            );
          })}
        </div>
        <div className="analytics-foot">
          {rows.length
            ? `${Math.round((funnel[3].value / rows.length) * 100)}% closed`
            : 'No matching records'}
          <span className="push-right">Stage conversion · not a forecast</span>
        </div>
      </article>
      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <h2>Time to arrive</h2>
            <p>Response distribution · minutes</p>
          </div>
          <Badge>SLA {duration(SLA.arrive)}</Badge>
        </div>
        {arrive.length ? (
          <Chart
            options={histogram}
            label={`Arrival time histogram. Median ${duration(median)}, p90 ${duration(p90)}, mean ${duration(average(arrive))}. Target eight minutes.`}
          />
        ) : (
          <div className="chart-empty">No arrivals yet for this selection.</div>
        )}
        <div className="analytics-foot">
          <span>
            Median <b>{duration(median)}</b>
          </span>
          <span className="push-right">
            p90 <b>{duration(p90)}</b>
          </span>
        </div>
      </article>
      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <h2>Top black-spot zones</h2>
            <p>Incident density · current selection</p>
          </div>
          <Crosshair size={15} className="muted" />
        </div>
        <div className="zones-list">
          {zones.length ? (
            zones.map((z, k) => (
              <button
                key={z.zone}
                onClick={() => {
                  useDashboardStore.setState((s) => ({
                    focusZone: z.zone,
                    layers: { ...s.layers, heatmap: true },
                  }));
                  document.getElementById('map')?.scrollIntoView({
                    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  });
                }}
              >
                <span className="zone-rank">{String(k + 1).padStart(2, '0')}</span>
                <span className="zone-info">
                  <strong>{z.zone}</strong>
                  <i>
                    <b style={{ width: `${(z.count / Math.max(1, zones[0].count)) * 100}%` }} />
                  </i>
                </span>
                <span className="mono">{z.count}</span>
                <ArrowUpRight size={13} />
              </button>
            ))
          ) : (
            <div className="chart-empty">No matching zones.</div>
          )}
        </div>
        <div className="analytics-foot">
          Explore a zone on the map
          <ArrowRight size={12} />
        </div>
      </article>
    </section>
  );
}
