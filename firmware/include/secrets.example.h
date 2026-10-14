/**
 * Copy this file to `secrets.h` and fill in your own values.
 * `secrets.h` is listed in .gitignore — never commit real phone numbers or keys.
 */
#pragma once

// Emergency contacts that receive the crash SMS (international format, no spaces).
// Up to 5 numbers. The first entries should be family; add the local
// emergency / volunteer coordinator number as well.
static const char* const EMERGENCY_CONTACTS[] = {
    "+919999999999",   // Family 1
    "+918888888888",   // Family 2
    // "+91XXXXXXXXXX", // Volunteer coordinator / fleet control room
};
static const int EMERGENCY_CONTACT_COUNT = sizeof(EMERGENCY_CONTACTS) / sizeof(EMERGENCY_CONTACTS[0]);

// ---- Optional: push the incident to the Firebase backend over Wi-Fi ----
// Only used when ALERT_PUSH_TO_BACKEND is set to 1 in config.h.
#define WIFI_SSID            "your-wifi-ssid"
#define WIFI_PASSWORD        "your-wifi-password"
#define BACKEND_INGEST_URL   "https://<region>-<project>.cloudfunctions.net/ingestIncident"
#define BACKEND_DEVICE_KEY   "device-api-key-from-firestore-devices-collection"
