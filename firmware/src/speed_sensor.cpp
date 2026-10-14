#include "speed_sensor.h"
#include "config.h"

SpeedSensor* SpeedSensor::instance_ = nullptr;

void SpeedSensor::begin(uint8_t pin, float wheelCircumferenceM, uint8_t magnetsPerRev) {
    pin_            = pin;
    metresPerPulse_ = wheelCircumferenceM / (float)(magnetsPerRev < 1 ? 1 : magnetsPerRev);
    instance_       = this;
    pinMode(pin_, INPUT);            // GPIO34-39 are input-only, no internal pull-up -> use external 10k
    attachInterrupt(digitalPinToInterrupt(pin_), SpeedSensor::isr, FALLING);
}

void IRAM_ATTR SpeedSensor::isr() {
    SpeedSensor* s = instance_;
    if (!s) return;
    const uint32_t now = micros();
    const uint32_t dt  = now - s->lastPulseUs_;
    if (dt < HALL_DEBOUNCE_US) return;        // software debounce
    s->periodUs_    = dt;
    s->lastPulseUs_ = now;
    s->pulseCount_++;
    s->newPulse_    = true;
}

uint32_t SpeedSensor::msSinceLastPulse() const {
    noInterrupts();
    const uint32_t last = lastPulseUs_;
    interrupts();
    return (micros() - last) / 1000UL;
}

void SpeedSensor::update() {
    noInterrupts();
    const uint32_t period = periodUs_;
    const bool     fresh  = newPulse_;
    newPulse_ = false;
    interrupts();

    if (fresh && period > 0) {
        // km/h = m/pulse * 3.6 / s/pulse
        speedKmh_  = metresPerPulse_ * 3.6f / ((float)period / 1e6f);
        hasSignal_ = true;
    }

    // No pulse for a while -> wheel stopped (or sensor misaligned)
    if (msSinceLastPulse() > SPEED_TIMEOUT_MS) {
        speedKmh_ = 0.0f;
    }
}
