#include "alert.h"
#include "config.h"

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #warning "secrets.h not found - using placeholder numbers from secrets.example.h"
  #include "secrets.example.h"
#endif

#if ALERT_PUSH_TO_BACKEND
  #include <WiFi.h>
  #include <HTTPClient.h>
#endif

void Alert::begin(Gsm& gsm, Gps& gps) {
    gsm_ = &gsm;
    gps_ = &gps;
#if ALERT_PUSH_TO_BACKEND
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);   // non-blocking; status checked in update()
#endif
}

String Alert::buildSms(const safemeter::IncidentInfo& inc) const {
    GpsFix f = gps_->fix();
    String s;
    s.reserve(160);
    s += "SAFEMETER CRASH ALERT\n";
    s += SM_VEHICLE_ID; s += ' '; s += f.timestampUtc; s += '\n';
    s += "Speed "; s += String((int)(inc.preImpactSpeedKmh + 0.5f)); s += "km/h ";
    s += "Impact "; s += String(inc.peakG, 1); s += "g\n";
    s += gps_->mapsLink(); s += '\n';
    s += "Call 108 if unreachable";
    if (s.length() > 160) s = s.substring(0, 160);
    return s;
}

String Alert::buildJson(const safemeter::IncidentInfo& inc, const char* eventType) const {
    GpsFix f = gps_->fix();
    String j;
    j.reserve(256);
    j += "{\"vehicleId\":\""; j += SM_VEHICLE_ID; j += "\",";
    j += "\"status\":\""; j += eventType; j += "\",";
    j += "\"timestampUtc\":\""; j += f.timestampUtc; j += "\",";
    j += "\"lat\":"; j += f.valid ? String(f.lat, 6) : "null"; j += ',';
    j += "\"lon\":"; j += f.valid ? String(f.lon, 6) : "null"; j += ',';
    j += "\"gpsAgeMs\":"; j += f.valid ? String(f.ageMs) : "null"; j += ',';
    j += "\"speedKmh\":"; j += String(inc.preImpactSpeedKmh, 1); j += ',';
    j += "\"peakG\":"; j += String(inc.peakG, 2); j += ',';
    j += "\"maxTiltDeg\":"; j += String(inc.maxTiltDeg, 1); j += ',';
    j += "\"firmware\":\""; j += SM_FIRMWARE_VERSION; j += "\"}";
    return j;
}

void Alert::dispatch(const safemeter::IncidentInfo& inc, const char* eventType) {
    const String sms = buildSms(inc);
    Serial.println("[ALERT] ---- SMS ----");
    Serial.println(sms);
    Serial.println("[ALERT] -------------");

    if (strcmp(eventType, "alerted") == 0) {
        for (int i = 0; i < EMERGENCY_CONTACT_COUNT; ++i) {
            if (!gsm_->sendSms(EMERGENCY_CONTACTS[i], sms)) {
                Serial.printf("[ALERT] GSM queue full, dropped %s\n", EMERGENCY_CONTACTS[i]);
            }
        }
    }

    pendingJson_      = buildJson(inc, eventType);
    backendPending_   = true;
    backendAttempts_  = 0;
    backendRetryAt_   = 0;
    Serial.println(pendingJson_);
}

void Alert::update() {
#if ALERT_PUSH_TO_BACKEND
    if (!backendPending_ || millis() < backendRetryAt_) return;
    if (WiFi.status() != WL_CONNECTED) { backendRetryAt_ = millis() + 5000; return; }
    pushToBackend(pendingJson_);
#endif
}

void Alert::pushToBackend(const String& json) {
#if ALERT_PUSH_TO_BACKEND
    HTTPClient http;
    http.setTimeout(8000);
    http.begin(BACKEND_INGEST_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", BACKEND_DEVICE_KEY);
    int code = http.POST(json);
    Serial.printf("[ALERT] backend POST -> %d\n", code);
    http.end();
    if (code >= 200 && code < 300) {
        backendPending_ = false;
    } else if (++backendAttempts_ >= 5) {
        backendPending_ = false;      // SMS already went out; don't retry forever
    } else {
        backendRetryAt_ = millis() + 15000;
    }
#else
    (void)json;
#endif
}
