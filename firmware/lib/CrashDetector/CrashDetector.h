/**
 * CrashDetector — hardware-independent three-stage crash detection state machine.
 *
 * This class contains NO Arduino / ESP32 dependencies so that it can be unit
 * tested natively on a PC (see firmware/test/test_native) and reused on other
 * microcontrollers.
 *
 * Inputs (fed every loop iteration via tick()):
 *   - nowMs        : monotonic time in milliseconds
 *   - speedKmh     : wheel speed from the hall sensor (GPS as fallback)
 *   - accelMagG    : total acceleration magnitude sqrt(ax²+ay²+az²) in g
 *   - tiltDeg      : angle between current gravity vector and the upright reference
 *   - cancelPressed: true while the cancel button is held
 *
 * Detection pipeline (all three stages must pass before the countdown starts):
 *   Stage 1 — Trigger      : accelMagG >= impactThresholdG while moving >= minSpeedKmh
 *   Stage 2 — Speed check  : after speedCheckWindowMs, speed must have dropped by
 *                            >= speedDropRatio relative to the pre-impact speed.
 *                            A pothole fails here because the wheel keeps turning.
 *   Stage 3 — Orientation  : TWO_WHEELER  -> tilt >= tiltThresholdDeg for >= tiltHoldMs
 *                            FOUR_WHEELER -> speed <= stationarySpeedKmh for >= stationaryHoldMs
 *   Countdown              : countdownMs to cancel, otherwise an ALERT event is emitted.
 */
#pragma once

#include <stdint.h>

namespace safemeter {

enum class VehicleType : uint8_t { TWO_WHEELER = 0, FOUR_WHEELER = 1 };

enum class State : uint8_t {
    NORMAL = 0,         // Live speed display, watching for an impact
    IMPACT_CHECK,       // Stage 2: waiting ~1 s to see whether speed collapses
    POST_IMPACT_CHECK,  // Stage 3: waiting for tilt / stationary confirmation
    COUNTDOWN,          // Crash confirmed, rider can cancel
    COOLDOWN            // Alert sent or cancelled; ignore re-triggers for a while
};

enum class Event : uint8_t {
    NONE = 0,
    IMPACT_TRIGGERED,      // Stage 1 passed
    REJECTED_SPEED,        // Stage 2 failed (pothole / speed breaker / glancing hit)
    REJECTED_ORIENTATION,  // Stage 3 failed (vehicle stayed upright / kept moving)
    CRASH_CONFIRMED,       // All stages passed, countdown started
    CANCELLED,             // Rider pressed cancel during countdown
    ALERT,                 // Countdown expired -> send SMS / push
    COOLDOWN_FINISHED
};

struct DetectorConfig {
    VehicleType vehicleType     = VehicleType::TWO_WHEELER;

    // Stage 1 — trigger
    float    impactThresholdG   = 4.0f;    // bench-test starting value; tune from logged data
    float    minSpeedKmh        = 20.0f;   // ignore impacts while (almost) stationary

    // Stage 2 — speed confirmation
    uint32_t speedCheckWindowMs = 1000;    // how long after impact we evaluate speed
    float    speedDropRatio     = 0.60f;   // speed must fall by >= 60 %
    uint32_t preImpactLookbackMs= 1000;    // "speed before impact" = max speed in this window

    // Stage 3 — orientation / stationary confirmation
    float    tiltThresholdDeg   = 60.0f;   // two-wheeler on its side
    uint32_t tiltHoldMs         = 2000;    // tilt must persist this long
    float    stationarySpeedKmh = 2.0f;    // four-wheeler "not moving"
    uint32_t stationaryHoldMs   = 3000;
    uint32_t postImpactTimeoutMs= 8000;    // give up waiting for stage 3 after this

    // Countdown & cooldown
    uint32_t countdownMs        = 15000;
    uint32_t cooldownMs         = 30000;
};

struct IncidentInfo {
    uint32_t impactTimeMs     = 0;
    float    preImpactSpeedKmh= 0.0f;
    float    peakG            = 0.0f;
    float    maxTiltDeg       = 0.0f;
};

class CrashDetector {
public:
    explicit CrashDetector(const DetectorConfig& cfg = DetectorConfig());

    /** Feed one sample. Returns the event produced in this tick (if any). */
    Event tick(uint32_t nowMs, float speedKmh, float accelMagG, float tiltDeg, bool cancelPressed);

    /** Reset to NORMAL and clear all incident data (e.g. after a manual test). */
    void reset();

    State              state()          const { return state_; }
    const IncidentInfo& incident()      const { return incident_; }
    const DetectorConfig& config()      const { return cfg_; }
    void setConfig(const DetectorConfig& cfg) { cfg_ = cfg; }

    /** Seconds remaining in the cancel countdown (0 when not counting down). */
    uint32_t countdownRemainingSec(uint32_t nowMs) const;

    /** Human readable names, useful for logs and the OLED. */
    static const char* stateName(State s);
    static const char* eventName(Event e);

private:
    static constexpr uint8_t  HISTORY_LEN       = 64;   // 64 samples x 50 ms = 3.2 s of speed history
    static constexpr uint32_t HISTORY_PERIOD_MS = 50;

    void  pushSpeed(uint32_t nowMs, float speedKmh);
    float maxSpeedInWindow(uint32_t nowMs, uint32_t windowMs) const;
    Event transition(State next, uint32_t nowMs, Event ev);

    DetectorConfig cfg_;
    State          state_ = State::NORMAL;
    uint32_t       stateEnteredMs_ = 0;
    IncidentInfo   incident_;

    // Stage-3 bookkeeping
    uint32_t       conditionStartMs_ = 0;   // when tilt/stationary condition first became true
    bool           conditionActive_  = false;

    // Rolling speed history
    struct Sample { uint32_t t; float v; };
    Sample   history_[HISTORY_LEN];
    uint8_t  historyHead_   = 0;
    uint8_t  historyCount_  = 0;
    uint32_t lastHistoryMs_ = 0;
};

}  // namespace safemeter
