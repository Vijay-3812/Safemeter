/**
 * Gps — NEO-6M wrapper around TinyGPS++.
 *
 * Keeps the last valid fix in memory so an alert can still carry a location
 * even if satellite lock is lost at the moment of the crash.
 */
#pragma once

#include <Arduino.h>
#include <TinyGPSPlus.h>

struct GpsFix {
    bool     valid = false;
    double   lat = 0, lon = 0;
    float    speedKmh = 0;
    uint32_t ageMs = UINT32_MAX;     // ms since this fix was received
    uint8_t  satellites = 0;
    char     timestampUtc[24] = "unknown";  // "2026-10-14 08:30:15Z"
};

class Gps {
public:
    void begin(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud = 9600);
    void update();

    GpsFix   fix() const;                       // snapshot with age computed
    bool     hasFix() const { return hasFix_; }
    uint32_t charsProcessed() const { return gps_.charsProcessed(); }

    /** Google Maps link for the last known position, e.g. https://maps.google.com/?q=12.93,80.21 */
    String mapsLink() const;

private:
    HardwareSerial* serial_ = nullptr;
    TinyGPSPlus     gps_;
    bool            hasFix_ = false;
    double          lat_ = 0, lon_ = 0;
    float           speedKmh_ = 0;
    uint8_t         sats_ = 0;
    uint32_t        lastFixMs_ = 0;
    char            timestamp_[24] = "unknown";
};
