#include "CrashDetector.h"

namespace safemeter {

CrashDetector::CrashDetector(const DetectorConfig& cfg) : cfg_(cfg) { reset(); }

void CrashDetector::reset() {
    state_           = State::NORMAL;
    stateEnteredMs_  = 0;
    incident_        = IncidentInfo();
    conditionActive_ = false;
    conditionStartMs_= 0;
    historyHead_     = 0;
    historyCount_    = 0;
    lastHistoryMs_   = 0;
}

// ---------------------------------------------------------------------------
// Rolling speed history (used to compute "speed before impact")
// ---------------------------------------------------------------------------
void CrashDetector::pushSpeed(uint32_t nowMs, float speedKmh) {
    if (historyCount_ > 0 && (nowMs - lastHistoryMs_) < HISTORY_PERIOD_MS) return;
    history_[historyHead_] = { nowMs, speedKmh };
    historyHead_ = (historyHead_ + 1) % HISTORY_LEN;
    if (historyCount_ < HISTORY_LEN) historyCount_++;
    lastHistoryMs_ = nowMs;
}

float CrashDetector::maxSpeedInWindow(uint32_t nowMs, uint32_t windowMs) const {
    float best = 0.0f;
    for (uint8_t i = 0; i < historyCount_; ++i) {
        const Sample& s = history_[i];
        if ((nowMs - s.t) <= windowMs && s.v > best) best = s.v;
    }
    return best;
}

Event CrashDetector::transition(State next, uint32_t nowMs, Event ev) {
    state_           = next;
    stateEnteredMs_  = nowMs;
    conditionActive_ = false;
    conditionStartMs_= 0;
    return ev;
}

// ---------------------------------------------------------------------------
// Main state machine
// ---------------------------------------------------------------------------
Event CrashDetector::tick(uint32_t nowMs, float speedKmh, float accelMagG, float tiltDeg, bool cancelPressed) {
    pushSpeed(nowMs, speedKmh);
    const uint32_t elapsed = nowMs - stateEnteredMs_;

    switch (state_) {

    // ----------------------------------------------------------- Stage 1
    case State::NORMAL: {
        if (accelMagG < cfg_.impactThresholdG) return Event::NONE;

        // Use the recent maximum so a wheel that locks *during* the impact
        // doesn't make us think we were stationary.
        float preSpeed = maxSpeedInWindow(nowMs, cfg_.preImpactLookbackMs);
        if (speedKmh > preSpeed) preSpeed = speedKmh;
        if (preSpeed < cfg_.minSpeedKmh) return Event::NONE;  // parked / walking-pace knocks

        incident_ = IncidentInfo();
        incident_.impactTimeMs      = nowMs;
        incident_.preImpactSpeedKmh = preSpeed;
        incident_.peakG             = accelMagG;
        incident_.maxTiltDeg        = tiltDeg;
        return transition(State::IMPACT_CHECK, nowMs, Event::IMPACT_TRIGGERED);
    }

    // ----------------------------------------------------------- Stage 2
    case State::IMPACT_CHECK: {
        if (accelMagG > incident_.peakG) incident_.peakG = accelMagG;
        if (tiltDeg   > incident_.maxTiltDeg) incident_.maxTiltDeg = tiltDeg;

        if (elapsed < cfg_.speedCheckWindowMs) return Event::NONE;

        const float limit = incident_.preImpactSpeedKmh * (1.0f - cfg_.speedDropRatio);
        if (speedKmh <= limit) {
            return transition(State::POST_IMPACT_CHECK, nowMs, Event::NONE);
        }
        // Wheel kept turning -> pothole / speed breaker / glancing hit.
        return transition(State::NORMAL, nowMs, Event::REJECTED_SPEED);
    }

    // ----------------------------------------------------------- Stage 3
    case State::POST_IMPACT_CHECK: {
        if (accelMagG > incident_.peakG) incident_.peakG = accelMagG;
        if (tiltDeg   > incident_.maxTiltDeg) incident_.maxTiltDeg = tiltDeg;

        bool     condition;
        uint32_t holdMs;
        if (cfg_.vehicleType == VehicleType::TWO_WHEELER) {
            condition = tiltDeg >= cfg_.tiltThresholdDeg;
            holdMs    = cfg_.tiltHoldMs;
        } else {
            condition = speedKmh <= cfg_.stationarySpeedKmh;
            holdMs    = cfg_.stationaryHoldMs;
        }

        if (condition) {
            if (!conditionActive_) { conditionActive_ = true; conditionStartMs_ = nowMs; }
            if ((nowMs - conditionStartMs_) >= holdMs) {
                return transition(State::COUNTDOWN, nowMs, Event::CRASH_CONFIRMED);
            }
        } else {
            conditionActive_ = false;  // condition must be continuous
        }

        if (elapsed >= cfg_.postImpactTimeoutMs) {
            return transition(State::NORMAL, nowMs, Event::REJECTED_ORIENTATION);
        }
        return Event::NONE;
    }

    // ----------------------------------------------------------- Countdown
    case State::COUNTDOWN: {
        if (cancelPressed) {
            return transition(State::COOLDOWN, nowMs, Event::CANCELLED);
        }
        if (elapsed >= cfg_.countdownMs) {
            return transition(State::COOLDOWN, nowMs, Event::ALERT);
        }
        return Event::NONE;
    }

    // ----------------------------------------------------------- Cooldown
    case State::COOLDOWN: {
        if (elapsed >= cfg_.cooldownMs) {
            return transition(State::NORMAL, nowMs, Event::COOLDOWN_FINISHED);
        }
        return Event::NONE;
    }
    }
    return Event::NONE;
}

uint32_t CrashDetector::countdownRemainingSec(uint32_t nowMs) const {
    if (state_ != State::COUNTDOWN) return 0;
    const uint32_t elapsed = nowMs - stateEnteredMs_;
    if (elapsed >= cfg_.countdownMs) return 0;
    return (cfg_.countdownMs - elapsed + 999) / 1000;  // round up
}

const char* CrashDetector::stateName(State s) {
    switch (s) {
        case State::NORMAL:            return "NORMAL";
        case State::IMPACT_CHECK:      return "IMPACT_CHECK";
        case State::POST_IMPACT_CHECK: return "POST_IMPACT_CHECK";
        case State::COUNTDOWN:         return "COUNTDOWN";
        case State::COOLDOWN:          return "COOLDOWN";
    }
    return "?";
}

const char* CrashDetector::eventName(Event e) {
    switch (e) {
        case Event::NONE:                 return "NONE";
        case Event::IMPACT_TRIGGERED:     return "IMPACT_TRIGGERED";
        case Event::REJECTED_SPEED:       return "REJECTED_SPEED";
        case Event::REJECTED_ORIENTATION: return "REJECTED_ORIENTATION";
        case Event::CRASH_CONFIRMED:      return "CRASH_CONFIRMED";
        case Event::CANCELLED:            return "CANCELLED";
        case Event::ALERT:                return "ALERT";
        case Event::COOLDOWN_FINISHED:    return "COOLDOWN_FINISHED";
    }
    return "?";
}

}  // namespace safemeter
