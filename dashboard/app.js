/**
 * SafeMeter dashboard
 *
 * - Live incident list + map markers from Firestore (`incidents` collection)
 * - Heatmap of incident density ("black spots")
 * - Response-time summary (time-to-accept / time-to-arrive)
 *
 * If `firebase-config.js` still contains the placeholder project id, the page
 * runs in DEMO MODE with generated incidents around Chennai so the UI can be
 * shown without a backend.
 */
(function () {
  "use strict";

  const STATUS_LABEL = {
    alerted: "Alerted",
    responder_assigned: "Responder assigned",
    responder_arrived: "Arrived",
    cancelled: "Cancelled",
    closed: "Closed",
  };
  const STATUS_COLOR = {
    alerted: "#e63946",
    responder_assigned: "#f4a261",
    responder_arrived: "#2a9d8f",
    cancelled: "#8d99ae",
    closed: "#457b9d",
  };

  // ------------------------------------------------------------------ map
  const map = L.map("map").setView([12.95, 80.2], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  const markerLayer = L.layerGroup().addTo(map);
  let heatLayer = null;

  // ------------------------------------------------------------------ state
  let incidents = [];
  let filter = "all";

  const $ = (id) => document.getElementById(id);

  function fmtTime(ts) {
    if (!ts) return "–";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-IN", { hour12: false, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function fmtSec(s) {
    if (s == null || isNaN(s)) return "–";
    const m = Math.floor(s / 60), r = Math.round(s % 60);
    return m ? `${m}m ${r}s` : `${r}s`;
  }
  function avg(arr) {
    const v = arr.filter((x) => typeof x === "number" && !isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  // ------------------------------------------------------------------ render
  function render() {
    // Stats
    $("stat-total").textContent = incidents.length;
    $("stat-alerted").textContent = incidents.filter((i) => i.status === "alerted").length;
    $("stat-cancelled").textContent = incidents.filter((i) => i.status === "cancelled").length;
    $("stat-assigned").textContent = incidents.filter((i) => i.status === "responder_assigned" || i.status === "responder_arrived").length;
    $("stat-accept").textContent = fmtSec(avg(incidents.map((i) => i.timeToAcceptSec)));
    $("stat-arrive").textContent = fmtSec(avg(incidents.map((i) => i.timeToArriveSec)));

    // Table
    const rows = incidents.filter((i) => filter === "all" || i.status === filter);
    const tbody = $("incidents").querySelector("tbody");
    tbody.innerHTML = "";
    for (const i of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtTime(i.createdAt)}</td>
        <td>${i.vehicleId || "–"}</td>
        <td>${Math.round(i.speedKmh || 0)} km/h</td>
        <td>${(i.peakG || 0).toFixed(1)} g</td>
        <td><span class="pill" style="background:${STATUS_COLOR[i.status] || "#999"}">${STATUS_LABEL[i.status] || i.status}</span></td>
        <td>${fmtSec(i.timeToAcceptSec)}</td>
        <td>${fmtSec(i.timeToArriveSec)}</td>`;
      if (i.lat != null && i.lon != null) {
        tr.style.cursor = "pointer";
        tr.onclick = () => map.setView([i.lat, i.lon], 15);
      }
      tbody.appendChild(tr);
    }

    // Markers
    markerLayer.clearLayers();
    for (const i of rows) {
      if (i.lat == null || i.lon == null) continue;
      L.circleMarker([i.lat, i.lon], {
        radius: 8,
        color: STATUS_COLOR[i.status] || "#999",
        fillColor: STATUS_COLOR[i.status] || "#999",
        fillOpacity: 0.85,
        weight: 2,
      })
        .bindPopup(
          `<b>${i.vehicleId}</b><br>${fmtTime(i.createdAt)}<br>` +
            `${Math.round(i.speedKmh || 0)} km/h, ${(i.peakG || 0).toFixed(1)} g<br>` +
            `Status: ${STATUS_LABEL[i.status] || i.status}<br>` +
            `<a target="_blank" href="https://maps.google.com/?q=${i.lat},${i.lon}">Open in Google Maps</a>`
        )
        .addTo(markerLayer);
    }

    // Heatmap (only real alerts, not cancelled ones)
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if ($("heat-toggle").checked) {
      const pts = incidents
        .filter((i) => i.status !== "cancelled" && i.lat != null)
        .map((i) => [i.lat, i.lon, Math.min(1, (i.peakG || 4) / 10)]);
      heatLayer = L.heatLayer(pts, { radius: 35, blur: 25, maxZoom: 15 }).addTo(map);
    }
  }

  $("filter").onchange = (e) => { filter = e.target.value; render(); };
  $("heat-toggle").onchange = render;

  // ------------------------------------------------------------------ data
  const cfg = window.SAFEMETER_FIREBASE_CONFIG;
  const isPlaceholder = !cfg || !cfg.projectId || /your-firebase-project-id/.test(cfg.projectId);

  if (!isPlaceholder && window.firebase) {
    firebase.initializeApp(cfg);
    $("mode-badge").textContent = "live · " + cfg.projectId;
    $("mode-badge").classList.add("live");
    firebase.auth().signInAnonymously().catch((e) => console.warn("auth", e));
    firebase
      .firestore()
      .collection("incidents")
      .orderBy("createdAt", "desc")
      .limit(500)
      .onSnapshot(
        (qs) => {
          incidents = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
          render();
        },
        (err) => {
          console.error(err);
          $("mode-badge").textContent = "error: " + err.code;
        }
      );
  } else {
    // ---------------------------------------------------------- DEMO MODE
    $("mode-badge").textContent = "demo data";
    $("mode-badge").classList.add("demo");
    $("demo-note").textContent = " Showing generated demo incidents — edit firebase-config.js to connect a project.";
    incidents = makeDemoIncidents(40);
    render();
    // simulate a new alert every 20 s so the live feel can be demonstrated
    setInterval(() => {
      incidents.unshift(randomIncident(new Date(), true));
      render();
    }, 20000);
  }

  // Deterministic-ish demo data around Chennai (OMR / ECR / Tambaram corridors)
  function makeDemoIncidents(n) {
    const out = [];
    const now = Date.now();
    for (let k = 0; k < n; k++) {
      out.push(randomIncident(new Date(now - k * 3600e3 * (1 + Math.random() * 6)), false));
    }
    return out;
  }
  function randomIncident(when, fresh) {
    const hotspots = [
      [12.9516, 80.2185], // Thoraipakkam OMR
      [12.9010, 80.2279], // Sholinganallur
      [12.9249, 80.1000], // Tambaram
      [12.9815, 80.2180], // Perungudi
      [13.0067, 80.2206], // Adyar
      [12.8406, 80.2456], // ECR
    ];
    const h = hotspots[Math.floor(Math.random() * hotspots.length)];
    const lat = h[0] + (Math.random() - 0.5) * 0.02;
    const lon = h[1] + (Math.random() - 0.5) * 0.02;
    const statuses = ["alerted", "responder_assigned", "responder_arrived", "cancelled", "closed"];
    const status = fresh ? "alerted" : statuses[Math.floor(Math.random() * statuses.length)];
    const accepted = ["responder_assigned", "responder_arrived", "closed"].includes(status);
    const arrived = ["responder_arrived", "closed"].includes(status);
    const tta = accepted ? 20 + Math.round(Math.random() * 90) : null;
    return {
      id: "demo-" + Math.random().toString(36).slice(2, 8),
      vehicleId: "SM-" + String(1 + Math.floor(Math.random() * 12)).padStart(3, "0"),
      status,
      lat, lon,
      speedKmh: 25 + Math.round(Math.random() * 50),
      peakG: +(4 + Math.random() * 8).toFixed(1),
      createdAt: when,
      timeToAcceptSec: tta,
      timeToArriveSec: arrived ? tta + 180 + Math.round(Math.random() * 600) : null,
    };
  }
})();
