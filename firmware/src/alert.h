/**
 * Alert — builds the crash message and dispatches it.
 *
 *   1. SMS to every number in EMERGENCY_CONTACTS (works without internet)
 *   2. Optional HTTPS POST to the Firebase backend (ingestIncident) when
 *      Wi-Fi is available — this is what wakes up the volunteer app.
 *
 * The SMS is kept under 160 characters so it goes out as a single segment:
 *
 *   SAFEMETER CRASH ALERT
 *   SM-001 2026-10-14 08:30:15Z
 *   Speed 48km/h Impact 6.2g
 *   https://maps.google.com/?q=12.934512,80.207812
 *   Call 108 if unreachable
 */
#pragma once

#include <Arduino.h>
#include "gsm.h"
#include "gps.h"
#include "CrashDetector.h"

class Alert {
public:
    void begin(Gsm& gsm, Gps& gps);

    /** Compose and queue the SMS for all contacts; optionally push to the backend. */
    void dispatch(const safemeter::IncidentInfo& inc, const char* eventType = "alerted");

    /** Build the SMS text (public so it can be printed to serial for demos). */
    String buildSms(const safemeter::IncidentInfo& inc) const;

    /** Build the JSON body for the backend. */
    String buildJson(const safemeter::IncidentInfo& inc, const char* eventType) const;

    /** Call from loop() — handles the (optional) backend push without blocking. */
    void update();

private:
    void pushToBackend(const String& json);

    Gsm* gsm_ = nullptr;
    Gps* gps_ = nullptr;
    String pendingJson_;
    bool   backendPending_ = false;
    uint32_t backendRetryAt_ = 0;
    uint8_t  backendAttempts_ = 0;
};
