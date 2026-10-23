import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from 'react-map-gl/maplibre';
import type { FeatureCollection, Feature, Point, Polygon } from 'geojson';
import { GeoJSONSource, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
// Explicit bundled worker URL works in dev, production and subpath hosting.
setWorkerUrl(mapWorkerUrl);
import {
  Expand,
  Layers,
  LocateFixed,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  WifiOff,
  X,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useReducedMotion } from 'motion/react';
import type { Incident } from '../../data/types';
import { CHENNAI_BOUNDS, corridors } from '../../data/geo/corridors';
import { metrics, useDashboardStore } from '../../store/useDashboardStore';
import { absoluteTime, relativeTime } from '../../lib/format';
import { severity, statusLabel } from '../../lib/severity';
import { Button, Pill, Switch, Tooltip } from '../../components/ui';
import 'maplibre-gl/dist/maplibre-gl.css';
function clusterCountSprite(id: string, map: MapRef | null) {
  if (!map || !/^count-\d+$/.test(id) || map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = token('--bg-base');
  context.font = '600 24px "Geist Variable", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(id.slice(6), 40, 24);
  map.addImage(id, context.getImageData(0, 0, 80, 48), { pixelRatio: 2 });
}
const CARTO = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const collection = <T extends Feature>(features: T[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});
const dot = (coordinates: number[], properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties,
});
function circle(lng: number, lat: number): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        Array.from({ length: 49 }, (_, k) => {
          const a = (k / 48) * Math.PI * 2;
          return [lng + Math.cos(a) * 0.018, lat + Math.sin(a) * 0.017];
        }),
      ],
    },
  };
}
// Offline context is deliberately schematic, not an alternative navigation basemap.
function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      corridors: {
        type: 'geojson',
        data: collection(
          corridors.map((c) => ({
            type: 'Feature' as const,
            properties: { name: c.name },
            geometry: { type: 'LineString' as const, coordinates: c.points.map((p) => [...p]) },
          })),
        ),
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': token('--bg-base') } },
      {
        id: 'schematic-road-casing',
        type: 'line',
        source: 'corridors',
        paint: { 'line-color': token('--bg-overlay'), 'line-width': 7 },
      },
      {
        id: 'schematic-roads',
        type: 'line',
        source: 'corridors',
        paint: { 'line-color': token('--text-tertiary'), 'line-width': 1, 'line-opacity': 0.32 },
      },
    ],
  };
}
export default function IncidentMap({ rows }: { rows: Incident[] }) {
  const mapRef = useRef<MapRef | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<StyleSpecification | string>(fallbackStyle);
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [webglError, setWebglError] = useState(() => {
    try {
      const c = document.createElement('canvas');
      return !c.getContext('webgl2');
    } catch {
      return true;
    }
  });
  const [hover, setHover] = useState<Incident | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const layers = useDashboardStore((s) => s.layers);
  const selected = useDashboardStore((s) => s.selected);
  const highlighted = useDashboardStore((s) => s.hovered);
  const incidents = useDashboardStore((s) => s.incidents);
  const focusZone = useDashboardStore((s) => s.focusZone);
  const now = useDashboardStore((s) => s.now);
  const reduced = useReducedMotion();
  const attachMap = useCallback((map: MapRef | null) => {
    mapRef.current = map;
    if (!map) return;
    map.getMap().setMissingStyleImageResolver((id) => clusterCountSprite(id, map));
    map.getCanvas().addEventListener('webglcontextlost', () => setWebglError(true), { once: true });
    setLoaded(true);
  }, []);
  const palette = useMemo(
    () => ({
      accent: token('--accent'),
      alert: token('--status-alerted'),
      assigned: token('--status-assigned'),
      arrived: token('--status-arrived'),
      closed: token('--status-closed'),
      cancelled: token('--status-cancelled'),
      base: token('--bg-base'),
      text: token('--text-primary'),
      cold: token('--heat-cold'),
      mid: token('--heat-mid'),
      hot: token('--heat-hot'),
      core: token('--heat-core'),
    }),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(CARTO, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Basemap unavailable');
        return r.json();
      })
      .then((json: StyleSpecification) => {
        setStyle(json);
        setOffline(false);
      })
      .catch(() => setOffline(true))
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);
  const points = useMemo(
    () =>
      collection(
        rows.map((i) =>
          dot([i.lng, i.lat], {
            id: i.id,
            status: i.status,
            severity: severity(i.impact).level,
            weight: i.impact / 14,
          }),
        ),
      ),
    [rows],
  );
  const assigned = useMemo(
    () => rows.filter((i) => i.responder && i.status === 'responder_assigned'),
    [rows],
  );
  const routes = useMemo(
    () =>
      collection(
        assigned.map((i) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [i.responder!.lng, i.responder!.lat],
              [i.lng, i.lat],
            ],
          },
        })),
      ),
    [assigned],
  );
  const coverage = useMemo(
    () => collection(assigned.map((i) => circle(i.responder!.lng, i.responder!.lat))),
    [assigned],
  );
  const fit = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!rows.length) {
      map.flyTo({ center: [80.19, 13.005], zoom: 10.2, duration: reduced ? 0 : 900 });
      return;
    }
    const xs = rows.map((i) => i.lng),
      ys = rows.map((i) => i.lat);
    map.fitBounds(
      [
        [Math.min(...xs) - 0.01, Math.min(...ys) - 0.01],
        [Math.max(...xs) + 0.01, Math.max(...ys) + 0.01],
      ],
      { padding: 70, maxZoom: 13, duration: reduced ? 0 : 900 },
    );
  }, [rows, reduced]);
  useEffect(() => {
    if (!selected || !loaded) return;
    const i = incidents.find((i) => i.id === selected);
    if (i)
      mapRef.current?.flyTo({ center: [i.lng, i.lat], zoom: 13.5, duration: reduced ? 0 : 900 });
  }, [selected, loaded, incidents, reduced]);
  useEffect(() => {
    if (!focusZone || !loaded) return;
    const corridor = corridors.find((c) => c.name === focusZone);
    if (corridor)
      mapRef.current?.flyTo({
        center: [corridor.points[1][0], corridor.points[1][1]],
        zoom: 12.8,
        duration: reduced ? 0 : 900,
      });
  }, [focusZone, loaded, reduced]);
  useEffect(() => {
    if (!loaded || reduced) return;
    let phase = 0;
    const timer = setInterval(() => {
      const map = mapRef.current?.getMap();
      if (map?.getLayer('dispatch-line'))
        map.setPaintProperty(
          'dispatch-line',
          'line-dasharray',
          [
            [0, 4, 3],
            [1, 4, 2],
            [2, 4, 1],
            [3, 4, 0],
          ][phase++ % 4],
        );
    }, 280);
    return () => clearInterval(timer);
  }, [loaded, reduced]);
  const onClick = async (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) return;
    if (feature.properties?.cluster) {
      const source = mapRef.current?.getSource('incident-points') as GeoJSONSource | undefined;
      if (!source) return;
      const zoom = await source.getClusterExpansionZoom(Number(feature.properties.cluster_id));
      const c = (feature.geometry as Point).coordinates;
      mapRef.current?.flyTo({
        center: [c[0], c[1]],
        zoom: Math.min(zoom, 16),
        duration: reduced ? 0 : 650,
      });
    } else if (feature.properties?.id)
      useDashboardStore.getState().select(String(feature.properties.id));
  };
  const stats = metrics(rows);
  const active = rows.filter((i) => i.status === 'alerted').slice(0, 12);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setFullscreen(false);
    } else if (container.current?.requestFullscreen) {
      void container.current
        .requestFullscreen()
        .then(() => setFullscreen(true))
        .catch(() =>
          useDashboardStore
            .getState()
            .notify('Fullscreen is unavailable in this embedded preview.'),
        );
    }
  };
  return (
    <section className="panel map-panel" id="map" ref={container} aria-label="Chennai incident map">
      <div className="panel-header">
        <div>
          <span className="section-dot" />
          <h2>Incident map</h2>
          <span className="subtle-divider">/</span>
          <span className="muted">Chennai metropolitan area</span>
        </div>
        <Button variant="ghost" onClick={fit}>
          <RotateCcw size={13} />
          Reset view
        </Button>
      </div>
      <div className="map-canvas">
        <div className="map-grid" />
        {!webglError ? (
          <Map
            ref={attachMap}
            initialViewState={{ longitude: 80.181, latitude: 13.006, zoom: 10.45, pitch: 0 }}
            mapStyle={style}
            maxBounds={
              [...CHENNAI_BOUNDS[0], ...CHENNAI_BOUNDS[1]] as [number, number, number, number]
            }
            minZoom={9}
            maxZoom={17}
            attributionControl={false}
            interactiveLayerIds={layers.incidents ? ['clusters', 'unclustered'] : []}
            onError={() => {
              setOffline(true);
              if (typeof style === 'object' && style.sources?.corridors) return;
              setStyle(fallbackStyle());
            }}
            onClick={(e) => void onClick(e)}
            onMouseMove={(e) => {
              const f = e.features?.find((f) => f.properties?.id);
              const i = f ? (rows.find((i) => i.id === f.properties?.id) ?? null) : null;
              setHover(i);
              useDashboardStore.getState().hover(i?.id ?? null);
            }}
            onMouseLeave={() => {
              setHover(null);
              useDashboardStore.getState().hover(null);
            }}
            canvasContextAttributes={{ antialias: true }}
          >
            <Source
              id="heat-points"
              type="geojson"
              data={collection(
                rows
                  .filter((i) => i.status !== 'cancelled')
                  .map((i) => dot([i.lng, i.lat], { weight: i.impact / 14 })),
              )}
            >
              <Layer
                id="heatmap"
                type="heatmap"
                layout={{ visibility: layers.heatmap ? 'visible' : 'none' }}
                paint={{
                  'heatmap-weight': ['get', 'weight'],
                  'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 15, 2],
                  'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 18, 14, 44],
                  'heatmap-opacity': 0.7,
                  'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0,
                    'rgba(0,0,0,0)',
                    0.2,
                    palette.cold,
                    0.45,
                    palette.mid,
                    0.7,
                    palette.hot,
                    1,
                    palette.core,
                  ],
                }}
              />
            </Source>
            <Source
              id="incident-points"
              type="geojson"
              data={points}
              cluster
              clusterRadius={42}
              clusterMaxZoom={13}
              clusterProperties={{ maxSeverity: ['max', ['get', 'severity']] }}
            >
              <Layer
                id="clusters"
                type="circle"
                filter={['has', 'point_count']}
                layout={{ visibility: layers.incidents ? 'visible' : 'none' }}
                paint={{
                  'circle-color': [
                    'match',
                    ['get', 'maxSeverity'],
                    4,
                    palette.alert,
                    3,
                    palette.assigned,
                    2,
                    palette.hot,
                    palette.closed,
                  ],
                  'circle-radius': ['step', ['get', 'point_count'], 16, 6, 20, 15, 25],
                  'circle-opacity': 0.85,
                  'circle-stroke-color': palette.base,
                  'circle-stroke-width': 3,
                }}
              />
              {loaded && (
                <Layer
                  id="cluster-count"
                  type="symbol"
                  filter={['has', 'point_count']}
                  layout={{
                    visibility: layers.incidents ? 'visible' : 'none',
                    'icon-image': ['concat', 'count-', ['to-string', ['get', 'point_count']]],
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                  }}
                />
              )}
              <Layer
                id="unclustered"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                layout={{ visibility: layers.incidents ? 'visible' : 'none' }}
                paint={{
                  'circle-color': [
                    'match',
                    ['get', 'status'],
                    'alerted',
                    palette.alert,
                    'responder_assigned',
                    palette.assigned,
                    'responder_arrived',
                    palette.arrived,
                    'closed',
                    palette.closed,
                    palette.cancelled,
                  ],
                  'circle-radius': [
                    'case',
                    ['==', ['get', 'id'], highlighted ?? ''],
                    9,
                    ['==', ['get', 'id'], selected ?? ''],
                    9,
                    ['in', ['get', 'status'], ['literal', ['closed', 'cancelled']]],
                    4,
                    6,
                  ],
                  'circle-opacity': [
                    'case',
                    ['in', ['get', 'status'], ['literal', ['closed', 'cancelled']]],
                    0.55,
                    1,
                  ],
                  'circle-stroke-width': 2,
                  'circle-stroke-color': palette.base,
                }}
              />
            </Source>
            {layers.coverage && (
              <Source id="coverage" type="geojson" data={coverage}>
                <Layer
                  id="coverage-fill"
                  type="fill"
                  paint={{ 'fill-color': palette.accent, 'fill-opacity': 0.045 }}
                />
                <Layer
                  id="coverage-outline"
                  type="line"
                  paint={{
                    'line-color': palette.accent,
                    'line-opacity': 0.25,
                    'line-width': 1,
                    'line-dasharray': [2, 3],
                  }}
                />
              </Source>
            )}
            {layers.responders && (
              <Source id="dispatch" type="geojson" data={routes}>
                <Layer
                  id="dispatch-line"
                  type="line"
                  paint={{
                    'line-color': palette.accent,
                    'line-width': 1.5,
                    'line-opacity': 0.6,
                    'line-dasharray': [0, 4, 3],
                  }}
                />
              </Source>
            )}
            {layers.incidents &&
              active.map((i) => (
                <Marker key={i.id} longitude={i.lng} latitude={i.lat}>
                  <button
                    aria-label={`Open alerted incident ${i.vehicle}`}
                    className="radar-marker"
                    onClick={(e) => {
                      e.stopPropagation();
                      useDashboardStore.getState().select(i.id);
                    }}
                  >
                    <span />
                    <i />
                  </button>
                </Marker>
              ))}
            {layers.incidents &&
              rows
                .filter((i) => i.id === selected || i.id === highlighted)
                .map((i) => (
                  <Marker key={`selected-${i.id}`} longitude={i.lng} latitude={i.lat}>
                    <span className="selection-ring" />
                  </Marker>
                ))}
            {layers.responders &&
              assigned
                .filter((i, index, all) => all.findIndex((x) => x.zone === i.zone) === index)
                .slice(0, 5)
                .map((i) => (
                  <Marker
                    key={`responder-${i.id}`}
                    longitude={i.responder!.lng}
                    latitude={i.responder!.lat}
                  >
                    <Tooltip
                      label={`${i.responder!.name} · ${i.responder!.distance} km · demo route`}
                    >
                      <button
                        className="responder-marker"
                        aria-label={`View responder for ${i.vehicle}`}
                        onClick={() => useDashboardStore.getState().select(i.id)}
                      >
                        <ShieldCheck size={14} />
                      </button>
                    </Tooltip>
                  </Marker>
                ))}
            {layers.responders &&
              assigned
                .filter((i, index, all) => all.findIndex((x) => x.zone === i.zone) === index)
                .slice(0, 5)
                .map((i) => (
                  <Marker
                    key={`eta-${i.id}`}
                    longitude={(i.lng + i.responder!.lng) / 2}
                    latitude={(i.lat + i.responder!.lat) / 2}
                  >
                    <span className="eta-label">{i.responder!.eta}m ETA</span>
                  </Marker>
                ))}
            {offline &&
              corridors.map((c) => (
                <Marker key={c.name} longitude={c.points[1][0]} latitude={c.points[1][1]}>
                  <span className="corridor-label">{c.name.split(' · ')[0]}</span>
                </Marker>
              ))}
            {hover && (
              <Popup
                longitude={hover.lng}
                latitude={hover.lat}
                offset={16}
                closeButton={false}
                closeOnClick={false}
              >
                <div className="map-tooltip">
                  <strong className="mono">{hover.vehicle}</strong>
                  <Pill status={hover.status} />
                  <p>
                    {hover.speed} km/h · {hover.impact.toFixed(1)}g ·{' '}
                    {relativeTime(hover.time, now)}
                  </p>
                  <small>{absoluteTime(hover.time)}</small>
                </div>
              </Popup>
            )}
          </Map>
        ) : (
          <div className="map-no-webgl">
            <WifiOff size={30} />
            <h3>Map rendering unavailable</h3>
            <p>
              Your browser needs WebGL for the geographic view. The incident list and analytics
              remain available.
            </p>
          </div>
        )}
        {/* HTML count labels avoid remote glyph downloads, including in offline mode. */}
        <div className="map-summary">
          <span className="live-dot" />
          <strong>{rows.length}</strong> incidents<span className="subtle-divider">·</span>
          <span className="urgent-text">{stats.counts.alerted} need attention</span>
        </div>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button className="map-layers-trigger">
              <Layers size={14} />
              Layers<small>{Object.values(layers).filter(Boolean).length}</small>
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" className="popover layers-panel" sideOffset={8}>
              <div className="popover-title">
                <h3>Map layers</h3>
                <Layers size={15} />
              </div>
              {(
                [
                  ['incidents', 'Incidents'],
                  ['heatmap', 'Black-spot heatmap'],
                  ['responders', 'Responder locations'],
                  ['coverage', 'Coverage radius'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Switch
                    label={label}
                    checked={layers[key]}
                    onCheckedChange={() => useDashboardStore.getState().toggleLayer(key)}
                  />
                </label>
              ))}
              <p className="muted">
                Coverage circles and straight dispatch lines are illustrative, not road routing.
              </p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="map-controls">
          <Tooltip label="Zoom in">
            <Button
              aria-label="Zoom in"
              onClick={() => mapRef.current?.zoomIn({ duration: reduced ? 0 : 200 })}
            >
              <Plus size={17} />
            </Button>
          </Tooltip>
          <Tooltip label="Zoom out">
            <Button
              aria-label="Zoom out"
              onClick={() => mapRef.current?.zoomOut({ duration: reduced ? 0 : 200 })}
            >
              <Minus size={17} />
            </Button>
          </Tooltip>
          <span />
          <Tooltip label="Fit to filtered incidents">
            <Button aria-label="Fit to incidents" onClick={fit}>
              <LocateFixed size={17} />
            </Button>
          </Tooltip>
          <Tooltip label="Fullscreen map">
            <Button aria-label="Toggle fullscreen map" onClick={toggleFullscreen}>
              {fullscreen ? <Maximize size={17} /> : <Expand size={17} />}
            </Button>
          </Tooltip>
        </div>
        <div className="map-legend">
          {Object.entries(stats.counts).map(([key, count]) => (
            <button
              key={key}
              onClick={() =>
                useDashboardStore.getState().setFilter({ status: key as Incident['status'] })
              }
            >
              <i className={`legend-dot status-dot-${key}`} />
              {statusLabel[key as Incident['status']]}
              <b>{count}</b>
            </button>
          ))}
        </div>
        {layers.heatmap && (
          <div className="heat-legend">
            <div />
            <span>Lower density</span>
            <span>Higher density</span>
          </div>
        )}
        {offline && (
          <div className="offline-notice" role="status">
            <WifiOff size={13} />
            <span>
              Basemap unavailable — showing incident layer only{' '}
              <small>Schematic road corridors, not navigation data</small>
            </span>
            <Button
              variant="ghost"
              aria-label="Dismiss offline notice"
              onClick={() => setOffline(false)}
            >
              <X size={12} />
            </Button>
          </div>
        )}
        {!rows.length && (
          <div className="map-empty">
            No incidents match this view. Adjust the filters to explore Chennai.
          </div>
        )}
        <div className="map-attribution">
          {!offline && (
            <>
              <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">
                © CARTO
              </a>
              <span> · </span>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                © OpenStreetMap
              </a>
              <span> · </span>
            </>
          )}
          Demo coordinates · Chennai
        </div>
      </div>
      <div className="map-footer">
        <span>
          <span className="live-dot" />
          Incident positions · simulated
        </span>
        <Tooltip label="Low <5g · Moderate 5–8g · Severe 8–11g inclusive · Critical >11g. Prototype display categories, not medical injury classifications.">
          <button className="severity-key">
            Impact severity <i />
            Low → Critical
          </button>
        </Tooltip>
      </div>
    </section>
  );
}
