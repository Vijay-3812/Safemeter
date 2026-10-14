/**
 * SpeedSensor — wheel speed from a hall-effect sensor + magnet(s).
 *
 * Each magnet pass triggers a FALLING interrupt. The ISR only records the
 * timestamp; all maths happens in update() from the main loop.
 *
 *   speed_kmh = (circumference / magnets_per_rev) * 3.6 / period_s
 */
#pragma once

#include <Arduino.h>

class SpeedSensor {
public:
    void begin(uint8_t pin, float wheelCircumferenceM, uint8_t magnetsPerRev);

    /** Call every loop iteration. Applies the no-pulse timeout. */
    void update();

    float    speedKmh()        const { return speedKmh_; }
    uint32_t pulseCount()      const { return pulseCount_; }
    uint32_t msSinceLastPulse() const;
    bool     hasSignal()       const { return hasSignal_; }

    /** Distance travelled since boot in metres (useful for the odometer / logging). */
    float distanceM() const { return pulseCount_ * metresPerPulse_; }

private:
    static void IRAM_ATTR isr();
    static SpeedSensor* instance_;

    volatile uint32_t lastPulseUs_   = 0;
    volatile uint32_t periodUs_      = 0;
    volatile uint32_t pulseCount_    = 0;
    volatile bool     newPulse_      = false;

    float   metresPerPulse_ = 1.95f;
    float   speedKmh_       = 0.0f;
    bool    hasSignal_      = false;
    uint8_t pin_            = 34;
};
