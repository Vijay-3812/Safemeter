# Implementation review

## Sequence completed

| Step | Result |
|---|---|
| **0 · Foundation** | Vite + React 18 + strict TypeScript, pnpm, exact dependencies/lockfile, token/Tailwind theme, typed store, simulation/source/legacy adapter and passing consistency tests |
| **1 · Shell** | Expanding desktop rail, responsive bottom navigation, dispatcher/preferences popovers, time-range ToggleGroup, command search and quiet demo indicator |
| **2 · KPIs** | Six shared-data cards, count-up, previous-window deltas, seven-point inline SVGs, status filters and illustrative SLA tracks |
| **3 · Map** | MapLibre Dark Matter integration, native GeoJSON clustering/max severity, native count-symbol sprites, heatmap, bounded camera, local offline schematic, active radar markers, responder routes and layer controls |
| **4 · Feed** | TanStack Table + Virtual, explicit CSS-grid tracks, debounced search, status facets, sorting, absolute/relative IST times, selection/hover linking and local actions |
| **5 · Investigation** | Radix modal drawer, reduced-motion-aware transition, response/telemetry tabs, timestamped stepper, schematic mini map, masked synthetic details, copy and JSON export |
| **6 · Analytics** | Custom token-derived ECharts theme, volume, funnel, arrival distribution and interactive ranked zones |
| **7 · Live/polish** | Seeded 20–40s snapshots, local-action overrides, pause/chime preferences, toast inbox, responsive/a11y tests, dependency audit, production build and deployment documentation |

## Changes from the original

- Replaced the flat CDN-script/Leaflet/Firebase dashboard with a modular, bundled React application. Fonts/icons are self-hosted and versions are pinned rather than relying on runtime CDN compatibility.
- Replaced large overlapping circles with native severity-aware clustering, compact active markers and a controlled layer hierarchy.
- Replaced the native select/checkbox controls with styled Radix primitives; added keyboard search and an investigation workflow instead of only a read-only table.
- Replaced independent/random UI calculations with a seeded source and one filtered set of rows for KPIs, map, feed and analytics.
- Preserved original incident fields through an adapter, but **did not preserve the old automatic Firebase connection** as an implied working integration. A typed API/WebSocket contract is the explicit next integration point.
- Replaced arbitrary scattered demo coordinates with interpolated land-side corridor waypoints and metro bounds.
- Added current-vs-previous-window comparisons from actual synthetic records rather than invented delta labels.
- Added source and geography transparency, offline fallback, local action semantics, tests and CI.

## Measured verification

Local verification on 23 October 2026:

| Gate | Result |
|---|---|
| Strict TypeScript and production Vite build | Passed, including browser/config TypeScript files |
| ESLint with `--max-warnings 0` | Passed |
| Prettier source check | Passed |
| Vitest | **8 tests passed**: seed/clock reproducibility, status totals, coordinates/timestamps, lifecycle progression, legacy adapter, emission cadence/cleanup, local override persistence and severity boundaries |
| Playwright | **2 end-to-end tests passed**, covering responsive views, KPI/row count filtering, local assignment, keyboard command search and accessibility |
| axe WCAG A/AA and 2.1 AA scan | No violations detected on the tested initial console and open drawer |
| Lighthouse 13.5.0 accessibility | **100/100** on the local production preview, desktop 1440 × 1000, packaged Chromium 133 |
| Dependency audit | Zero known vulnerabilities reported, including development dependencies, at the time checked |
| Application console | No uncaught page exceptions or application warnings during the tested production/offline screenshot flow |

Lighthouse/axe are automated checks, not a complete accessibility certification. The full public CARTO tile path was **not end-to-end validated in this network-restricted environment**. An intentional HTTP 503 in browser tests verifies the fallback; a browser can log the expected failed resource request even though the application handles it. This is not claimed as “no network errors”.

Screenshots and layout checks covered **1920, 1440, 1280, 1024, 768 and 390px**. Tests assert no page-level horizontal overflow and no clipped KPI labels/trends/captions, analytics headings or feed footer. Secondary table columns deliberately collapse rather than overlapping; full fields are available in the detail drawer. Controlled table and status-chip scrolling is internal to the panel, not page overflow.

## Design critic pass and self-review

- **Hierarchy:** reduced decorative effects; limited glow/pulse to active signals; kept analytics secondary to incident triage.
- **Clipping:** corrected KPI caption wrapping at intermediate widths and tightened zone-list spacing so the fourth entry does not consume its footer.
- **Navigation:** stopped the rail expanding merely because the pointer begins at the viewport corner. It expands over actual navigation items.
- **Map labels:** count symbols use locally rendered sprites, so cluster counts do not require remote font glyphs. Kept a readable offline disclosure rather than showing an unexplained blank map.
- **Interaction:** corrected row-action ARIA containment; fixed a MapLibre/react-map-gl version mismatch identified by resize tests; preserved local cancellations across source updates.
- **Contrast:** raised tertiary text brightness; status text is lighter than its associated marker colour. Minimum UI text is 12px.
- **Token use:** custom UI/theme colours, main spacing scale, focus/elevation and radii originate in `tokens.css`. Map geometry, column widths, tiny optical adjustments, icon sizes and chart coordinates remain component-specific dimensions, not semantic spacing tokens. Library internals retain their own styles.
- **States:** shared buttons cover hover/focus/active/disabled; icon-only actions have accessible names, with tooltips on principal controls; fields and Radix primitives have focus and selected states. Source errors, loading and no-match/empty views are covered. Browser tests do not exhaustively verify every possible input/device combination.
- **Performance:** lazy map/analytics features, ECharts tree-shaken registration, native clustering, bounded active HTML markers, virtual rows and minute-bucket memoised aggregate calculations. No measured universal 60fps claim is made.

## Explicit trade-offs / remaining work

- **No production backend, FastAPI service, real dispatch, SMS gateway, ambulance integration or authentication was added.** The API source is a contract stub. Production requires authenticated writes, authorization/rate-limit review, socket reconnect/health handling, privacy controls and physical-system testing.
- CARTO basemap depends on internet and WebGL. Offline mode is schematic and labelled. If WebGL itself is unavailable, the map displays an explanation and the table/analytics remain usable; this is not a fully offline map-tile package.
- Reverse-geocoded addresses, navigation routing, geodesic ETAs and real coverage are not supplied. Corridor labels, masked contacts, responder units, dispatch lines and the telemetry trace are synthetic illustrations.
- The drawer uses a static SVG location schematic rather than a second live map to avoid a second WebGL context and extra network cost.
- Rows are **60px**, not the brief's 44–48px target, to keep two-line incident information legible at 12px and preserve room for the live unattended counter. Accept/arrive/when columns are hidden progressively in narrow panels; none of their data is removed from the drawer/export.
- Narrow screens stack metrics, map, feed and analytics with a bottom rail. There is no separate mobile map-first tab or native application shell.
- Funnel stage conversion and arrival histogram are implemented; p50/p90 appear in the chart footer/accessible description, with an SLA line in the histogram. Additional percentile lines, per-zone trend arrows and a responder-availability donut were not added because the demo lacks a separate historical/availability ground truth.
- Time-range selection updates the shared view. `Live` is a rolling 24h window with live source updates; it is not an assertion of real emergencies. The generated history covers three days, so 7d/30d views contain no invented additional history.
- Sound is browser-generated, opt-in and best-effort under autoplay restrictions. Local action history, preferences and notifications are not persisted after reload.
- No light theme, notification delivery service or external analytics was added. No screenshot/README image is presented as evidence of a real response network.
