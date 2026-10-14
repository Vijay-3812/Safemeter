# System architecture

## Overview

```mermaid
flowchart TB
    subgraph Vehicle["On-vehicle unit (ESP32)"]
        HALL[Hall sensor<br/>wheel speed] --> DET
        IMU[MPU6050<br/>impact + tilt] --> DET
        GPS[NEO-6M<br/>position] --> ALERT
        DET[CrashDetector<br/>3-stage state machine] -->|15 s countdown| UI[OLED + buzzer<br/>cancel button]
        UI -->|cancel| DET
        DET -->|ALERT| ALERT[Alert builder]
        ALERT --> GSM[SIM800L<br/>SMS queue]
        ALERT -.->|optional Wi-Fi| HTTP[HTTPS POST]
    end

    GSM -->|SMS| FAM[Family / emergency<br/>contacts]
    GSM -.->|SMS gateway| INGEST
    HTTP --> INGEST[ingestIncident<br/>Cloud Function]

    subgraph Cloud["Firebase"]
        INGEST --> FS[(Firestore<br/>incidents / volunteers / devices)]
        FS -->|onCreate| DISPATCH[onIncidentCreated<br/>geo-query + FCM]
        ACCEPT[acceptIncident<br/>first wins] --> FS
        ARRIVE[markArrived] --> FS
    end

    DISPATCH -->|push| APP[Volunteer app<br/>Flutter]
    APP --> ACCEPT
    APP --> ARRIVE
    FS -->|realtime| DASH[Dashboard<br/>map · heatmap · response times]
```

**Design principle — SMS first.** The life-critical path (device → SMS → family/emergency
numbers) needs only 2G voice/SMS coverage and no app, phone or internet. Everything in the cloud
is an *addition* (volunteer layer, analytics); if it is down, riders are still protected.

## Detection state machine

```mermaid
stateDiagram-v2
    [*] --> NORMAL
    NORMAL --> IMPACT_CHECK : |a| ≥ 4 g AND speed ≥ 20 km/h<br/>(IMPACT_TRIGGERED)
    IMPACT_CHECK --> NORMAL : after 1 s speed still > 40 % of pre-impact<br/>(REJECTED_SPEED — pothole)
    IMPACT_CHECK --> POST_IMPACT_CHECK : speed dropped ≥ 60 % within 1 s
    POST_IMPACT_CHECK --> NORMAL : upright / moving for 8 s<br/>(REJECTED_ORIENTATION)
    POST_IMPACT_CHECK --> COUNTDOWN : tilt ≥ 60° for 2 s (2-wheeler)<br/>or stationary 3 s (4-wheeler)<br/>(CRASH_CONFIRMED)
    COUNTDOWN --> COOLDOWN : button pressed (CANCELLED)
    COUNTDOWN --> COOLDOWN : 15 s elapsed (ALERT → SMS)
    COOLDOWN --> NORMAL : 30 s
```

Implementation: [`firmware/lib/CrashDetector/CrashDetector.cpp`](../firmware/lib/CrashDetector/CrashDetector.cpp)
(hardware-independent, unit-tested in [`firmware/test/test_native`](../firmware/test/test_native/test_crash_detector.cpp)).

## Alert sequence

```mermaid
sequenceDiagram
    participant R as Rider
    participant U as SafeMeter unit
    participant G as GSM network
    participant F as Family phone
    participant B as Firebase
    participant V as Volunteer app
    participant D as Dashboard

    U->>U: impact → speed check → tilt check
    U->>R: buzzer + "CRASH DETECTED 15…0"
    alt rider cancels
        R->>U: press button
        U-->>B: {status: cancelled} (log only)
    else no cancel
        U->>G: AT+CMGS (SMS × N contacts)
        G->>F: SMS with map link, speed, time
        U->>B: POST ingestIncident (if Wi-Fi / gateway)
        B->>B: geohash query volunteers ≤ 5 km
        B->>V: FCM push
        V->>B: acceptIncident (transaction, first wins)
        B->>V: others: "case taken"
        V->>B: markArrived
        B->>D: realtime update (time-to-accept, time-to-arrive)
    end
```

## Timing budget (target)

| Step | Target | Notes |
|------|--------|-------|
| Impact → crash confirmed | ≤ 3.5 s | 1 s speed window + 2 s tilt hold |
| Cancel window | 15 s | fixed |
| SMS composed → delivered | 5 – 20 s | depends on network |
| **Impact → family phone** | **≈ 25 – 40 s** | |
| Push → volunteer accept | measured in pilot | |

## Repository map

| Directory | Component | Language / stack |
|-----------|-----------|------------------|
| `firmware/` | ESP32 unit | C++ (PlatformIO, Arduino framework) |
| `backend/` | Cloud Functions, Firestore rules | Node.js 20, Firebase |
| `volunteer-app/` | Responder app | Flutter / Dart |
| `dashboard/` | Incident dashboard | Static HTML + Leaflet + Firebase JS |
| `tools/` | Data logger, analysis | Python |
| `hardware/` | BOM, wiring, rig | Markdown |
| `docs/` | Concept + prototype docs, plans | Markdown + original PDFs |
