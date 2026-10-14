/**
 * SafeMeter backend — Firebase Cloud Functions
 *
 *  ingestIncident   HTTPS   Device (or SMS gateway) posts a crash event.
 *  onIncidentCreated Trigger Finds volunteers within RADIUS_KM and pushes an FCM alert.
 *  acceptIncident   Callable First volunteer to accept becomes the responder (transactional).
 *  markArrived      Callable Responder reports arrival; response-time metrics are stored.
 *
 * Data model: see ../schema.md
 */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const geofire = require("geofire-common");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const REGION = process.env.FUNCTIONS_REGION || "asia-south1";
const RADIUS_KM = Number(process.env.VOLUNTEER_RADIUS_KM || 5);
const MAX_VOLUNTEERS_NOTIFIED = 15;

// ---------------------------------------------------------------------------
// 1. Device -> backend ingest
// ---------------------------------------------------------------------------
exports.ingestIncident = functions.region(REGION).https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const body = req.body || {};
  const { vehicleId, status = "alerted", lat, lon, speedKmh, peakG, maxTiltDeg, timestampUtc, gpsAgeMs, firmware } = body;
  if (!vehicleId) {
    res.status(400).json({ error: "vehicleId required" });
    return;
  }

  // Authenticate the device with its per-device key
  const deviceSnap = await db.collection("devices").doc(vehicleId).get();
  if (!deviceSnap.exists) {
    res.status(403).json({ error: "unknown device" });
    return;
  }
  const device = deviceSnap.data();
  const key = req.get("x-device-key");
  if (!device.apiKey || key !== device.apiKey) {
    res.status(403).json({ error: "bad device key" });
    return;
  }

  const hasLocation = typeof lat === "number" && typeof lon === "number";
  const incident = {
    vehicleId,
    ownerName: device.ownerName || null,
    ownerPhone: device.ownerPhone || null,
    status, // alerted | cancelled | responder_assigned | responder_arrived | closed
    speedKmh: Number(speedKmh) || 0,
    peakG: Number(peakG) || 0,
    maxTiltDeg: Number(maxTiltDeg) || 0,
    lat: hasLocation ? lat : null,
    lon: hasLocation ? lon : null,
    geohash: hasLocation ? geofire.geohashForLocation([lat, lon]) : null,
    gpsAgeMs: typeof gpsAgeMs === "number" ? gpsAgeMs : null,
    deviceTimestampUtc: timestampUtc || null,
    firmware: firmware || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    responderId: null,
    acceptedAt: null,
    arrivedAt: null,
    notifiedCount: 0,
  };
  const ref = await db.collection("incidents").add(incident);
  res.status(201).json({ id: ref.id });
});

// ---------------------------------------------------------------------------
// 2. New incident -> notify nearby volunteers
// ---------------------------------------------------------------------------
exports.onIncidentCreated = functions
  .region(REGION)
  .firestore.document("incidents/{incidentId}")
  .onCreate(async (snap, ctx) => {
    const inc = snap.data();
    if (inc.status !== "alerted") return null; // cancelled events are logged only
    if (inc.lat == null || inc.lon == null) {
      functions.logger.warn("incident without location, cannot geo-match volunteers", { id: ctx.params.incidentId });
      return null;
    }

    const center = [inc.lat, inc.lon];
    const bounds = geofire.geohashQueryBounds(center, RADIUS_KM * 1000);
    const snapshots = await Promise.all(
      bounds.map(([start, end]) =>
        db.collection("volunteers")
          .where("available", "==", true)
          .orderBy("geohash")
          .startAt(start)
          .endAt(end)
          .get()
      )
    );

    const candidates = [];
    for (const qs of snapshots) {
      for (const doc of qs.docs) {
        const v = doc.data();
        if (typeof v.lat !== "number" || typeof v.lon !== "number") continue;
        const distKm = geofire.distanceBetween([v.lat, v.lon], center);
        if (distKm <= RADIUS_KM && v.fcmToken) {
          candidates.push({ id: doc.id, distKm, token: v.fcmToken });
        }
      }
    }
    candidates.sort((a, b) => a.distKm - b.distKm);
    const chosen = candidates.slice(0, MAX_VOLUNTEERS_NOTIFIED);

    if (chosen.length === 0) {
      functions.logger.warn("no volunteers in range", { id: ctx.params.incidentId, radiusKm: RADIUS_KM });
      await snap.ref.update({ notifiedCount: 0, notifiedAt: admin.firestore.FieldValue.serverTimestamp() });
      return null;
    }

    const mapsUrl = `https://maps.google.com/?q=${inc.lat},${inc.lon}`;
    const message = {
      tokens: chosen.map((c) => c.token),
      notification: {
        title: "🚨 SafeMeter crash alert nearby",
        body: `${Math.round(inc.speedKmh)} km/h impact, ${chosen[0].distKm.toFixed(1)} km from you. Tap to respond.`,
      },
      data: {
        type: "incident",
        incidentId: ctx.params.incidentId,
        lat: String(inc.lat),
        lon: String(inc.lon),
        speedKmh: String(inc.speedKmh),
        peakG: String(inc.peakG),
        mapsUrl,
      },
      android: { priority: "high", notification: { channelId: "safemeter_alerts", sound: "default" } },
      apns: { payload: { aps: { sound: "default", "interruption-level": "time-sensitive" } } },
    };

    const result = await messaging.sendEachForMulticast(message);
    functions.logger.info("volunteers notified", {
      id: ctx.params.incidentId,
      success: result.successCount,
      failure: result.failureCount,
    });

    // Clean up dead tokens
    const dead = [];
    result.responses.forEach((r, i) => {
      if (!r.success && r.error && /registration-token-not-registered/.test(r.error.code)) {
        dead.push(chosen[i].id);
      }
    });
    await Promise.all(dead.map((id) => db.collection("volunteers").doc(id).update({ fcmToken: null })));

    return snap.ref.update({
      notifiedCount: result.successCount,
      notifiedVolunteerIds: chosen.map((c) => c.id),
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// ---------------------------------------------------------------------------
// 3. First volunteer to accept wins
// ---------------------------------------------------------------------------
exports.acceptIncident = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in first");
  const { incidentId } = data || {};
  if (!incidentId) throw new functions.https.HttpsError("invalid-argument", "incidentId required");

  const uid = context.auth.uid;
  const ref = db.collection("incidents").doc(incidentId);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "incident not found");
    const inc = snap.data();
    if (inc.responderId && inc.responderId !== uid) {
      return { taken: true, responderId: inc.responderId };
    }
    if (inc.responderId === uid) return { taken: false, already: true };

    const now = admin.firestore.Timestamp.now();
    const createdAt = inc.createdAt || now;
    tx.update(ref, {
      responderId: uid,
      acceptedAt: now,
      status: "responder_assigned",
      timeToAcceptSec: now.seconds - createdAt.seconds,
    });
    return { taken: false };
  });

  if (outcome.taken) {
    throw new functions.https.HttpsError("already-exists", "This case has already been taken by another volunteer");
  }

  // Tell the other notified volunteers the case is taken (best effort)
  const snap = await ref.get();
  const ids = (snap.data().notifiedVolunteerIds || []).filter((id) => id !== uid);
  if (ids.length) {
    const vols = await Promise.all(ids.map((id) => db.collection("volunteers").doc(id).get()));
    const tokens = vols.map((v) => v.exists && v.data().fcmToken).filter(Boolean);
    if (tokens.length) {
      await messaging.sendEachForMulticast({
        tokens,
        notification: { title: "Case taken", body: "Another volunteer is responding. Thank you for being ready." },
        data: { type: "case_taken", incidentId },
      });
    }
  }
  return { ok: true };
});

// ---------------------------------------------------------------------------
// 4. Responder arrived on scene
// ---------------------------------------------------------------------------
exports.markArrived = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in first");
  const { incidentId } = data || {};
  const ref = db.collection("incidents").doc(incidentId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "incident not found");
  const inc = snap.data();
  if (inc.responderId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "You are not the assigned responder");
  }
  const now = admin.firestore.Timestamp.now();
  await ref.update({
    arrivedAt: now,
    status: "responder_arrived",
    timeToArriveSec: now.seconds - (inc.createdAt || now).seconds,
  });
  return { ok: true };
});
