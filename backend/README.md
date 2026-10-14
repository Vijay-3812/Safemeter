# SafeMeter backend (Firebase)

Cloud Functions + Firestore that turn a device alert into a volunteer dispatch and
record response times for the dashboard.

```
device ──SMS──► family / emergency numbers          (always, no internet needed)
device ──HTTPS──► ingestIncident ─► incidents/{id}
                                     │
                                     └─► onIncidentCreated ─► geo-query volunteers ─► FCM push
                                                                      │
                      volunteer app ──► acceptIncident (first wins) ◄─┘
                      volunteer app ──► markArrived
dashboard ◄── Firestore realtime listener on incidents/
```

## Functions

| Function            | Type              | Purpose                                                      |
|---------------------|-------------------|--------------------------------------------------------------|
| `ingestIncident`    | HTTPS `POST`      | Device posts `{vehicleId, lat, lon, speedKmh, peakG, …}` with header `x-device-key` |
| `onIncidentCreated` | Firestore trigger | Finds available volunteers within `VOLUNTEER_RADIUS_KM` (default 5) and sends FCM |
| `acceptIncident`    | Callable          | Transactional first-accept-wins; notifies others "case taken" |
| `markArrived`       | Callable          | Records `timeToArriveSec`                                     |

Data model: [`schema.md`](schema.md)

## Setup

```bash
npm i -g firebase-tools
firebase login
firebase projects:create safemeter-dev        # or use an existing project
# edit .firebaserc -> "default": "<your-project-id>"

cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,functions
```

Enable in the Firebase console: **Firestore**, **Authentication** (Anonymous or Phone),
**Cloud Messaging**.

Register a device (run once from any Node script with admin credentials, or paste in the
console):

```js
db.collection("devices").doc("SM-001").set({
  apiKey: "choose-a-long-random-secret",
  ownerName: "Demo Rider", ownerPhone: "+919999999999", vehicleType: "two_wheeler",
});
```

Put the same key in `firmware/include/secrets.h` as `BACKEND_DEVICE_KEY` and set
`ALERT_PUSH_TO_BACKEND 1` in `config.h` if the unit has Wi-Fi (demo) — in the field the SMS
path is primary and an SMS-to-HTTP gateway can feed `ingestIncident` instead.

## Local emulator

```bash
cd functions && npm install && cd ..
firebase emulators:start
```

Fire a test incident at the emulator:

```bash
curl -X POST http://localhost:5001/<project-id>/asia-south1/ingestIncident \
  -H 'Content-Type: application/json' -H 'x-device-key: choose-a-long-random-secret' \
  -d '{"vehicleId":"SM-001","status":"alerted","lat":12.9345,"lon":80.2078,"speedKmh":48,"peakG":6.2,"timestampUtc":"2026-10-14 08:30:15Z"}'
```

## Configuration

| Env var               | Default       | Meaning                           |
|-----------------------|---------------|-----------------------------------|
| `FUNCTIONS_REGION`    | `asia-south1` | Mumbai region                     |
| `VOLUNTEER_RADIUS_KM` | `5`           | Search radius for volunteer paging |

## Without a smartphone backend?

The SMS path is deliberately self-sufficient. The backend only adds the volunteer layer
and analytics. If the Firebase project is unavailable, riders are still protected by SMS
to family and emergency numbers.
