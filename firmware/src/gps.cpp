#include "gps.h"

void Gps::begin(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud) {
    serial_ = &serial;
    serial_->begin(baud, SERIAL_8N1, rxPin, txPin);
}

void Gps::update() {
    if (!serial_) return;
    while (serial_->available()) {
        gps_.encode((char)serial_->read());
    }
    if (gps_.location.isUpdated() && gps_.location.isValid()) {
        lat_       = gps_.location.lat();
        lon_       = gps_.location.lng();
        hasFix_    = true;
        lastFixMs_ = millis();
    }
    if (gps_.speed.isUpdated() && gps_.speed.isValid()) {
        speedKmh_ = (float)gps_.speed.kmph();
    }
    if (gps_.satellites.isValid()) sats_ = (uint8_t)gps_.satellites.value();
    if (gps_.date.isValid() && gps_.time.isValid() && gps_.date.year() > 2000) {
        snprintf(timestamp_, sizeof(timestamp_), "%04d-%02d-%02d %02d:%02d:%02dZ",
                 gps_.date.year(), gps_.date.month(), gps_.date.day(),
                 gps_.time.hour(), gps_.time.minute(), gps_.time.second());
    }
}

GpsFix Gps::fix() const {
    GpsFix f;
    f.valid      = hasFix_;
    f.lat        = lat_;
    f.lon        = lon_;
    f.speedKmh   = speedKmh_;
    f.satellites = sats_;
    f.ageMs      = hasFix_ ? (millis() - lastFixMs_) : UINT32_MAX;
    strncpy(f.timestampUtc, timestamp_, sizeof(f.timestampUtc));
    return f;
}

String Gps::mapsLink() const {
    if (!hasFix_) return String("location unavailable (no GPS fix)");
    char buf[64];
    snprintf(buf, sizeof(buf), "https://maps.google.com/?q=%.6f,%.6f", lat_, lon_);
    return String(buf);
}
