/**
 * Native unit tests for the CrashDetector state machine.
 * Run with:  pio test -e native
 *
 * Each test replays a synthetic ride at 100 Hz through the detector and checks
 * which events are produced. These scenarios mirror the test categories in the
 * validation plan (pothole, speed breaker, hard braking, crash, cancel).
 */
#include <unity.h>
#include "CrashDetector.h"

using namespace safemeter;

namespace {

struct Replay {
    CrashDetector det;
    uint32_t now = 0;
    int counts[8] = {0};
    Event last = Event::NONE;

    explicit Replay(const DetectorConfig& c = DetectorConfig()) : det(c) {}

    // Feed `ms` milliseconds of constant conditions at 100 Hz.
    void run(uint32_t ms, float speed, float g, float tilt, bool cancel = false) {
        for (uint32_t t = 0; t < ms; t += 10) {
            now += 10;
            Event e = det.tick(now, speed, g, tilt, cancel);
            counts[static_cast<int>(e)]++;
            if (e != Event::NONE) last = e;
        }
    }
    // Linear ramp of speed from v0 to v1 over `ms`.
    void ramp(uint32_t ms, float v0, float v1, float g, float tilt) {
        uint32_t steps = ms / 10;
        for (uint32_t i = 0; i < steps; ++i) {
            now += 10;
            float v = v0 + (v1 - v0) * (float)i / (float)steps;
            Event e = det.tick(now, v, g, tilt, false);
            counts[static_cast<int>(e)]++;
            if (e != Event::NONE) last = e;
        }
    }
    int count(Event e) const { return counts[static_cast<int>(e)]; }
};

}  // namespace

void setUp() {}
void tearDown() {}

// ---------------------------------------------------------------------------
void test_normal_riding_never_triggers() {
    Replay r;
    r.run(10000, 45.0f, 1.0f, 3.0f);          // 10 s cruising, 1 g, nearly upright
    TEST_ASSERT_EQUAL(0, r.count(Event::IMPACT_TRIGGERED));
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_pothole_is_rejected_by_speed_check() {
    Replay r;
    r.run(3000, 40.0f, 1.0f, 2.0f);           // cruise
    r.run(60,   40.0f, 6.0f, 2.0f);           // 60 ms vertical spike
    r.run(3000, 40.0f, 1.0f, 2.0f);           // wheel keeps turning
    TEST_ASSERT_EQUAL(1, r.count(Event::IMPACT_TRIGGERED));
    TEST_ASSERT_EQUAL(1, r.count(Event::REJECTED_SPEED));
    TEST_ASSERT_EQUAL(0, r.count(Event::CRASH_CONFIRMED));
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_speed_breaker_is_rejected() {
    Replay r;
    r.run(3000, 30.0f, 1.0f, 2.0f);
    r.run(80,   28.0f, 4.5f, 4.0f);           // front wheel
    r.run(300,  26.0f, 1.2f, 4.0f);
    r.run(80,   25.0f, 4.2f, 4.0f);           // rear wheel
    r.run(3000, 27.0f, 1.0f, 2.0f);           // speed dips slightly then recovers
    TEST_ASSERT_EQUAL(0, r.count(Event::CRASH_CONFIRMED));
    TEST_ASSERT_TRUE(r.count(Event::REJECTED_SPEED) >= 1);
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_hard_braking_never_triggers() {
    Replay r;
    r.run(2000, 60.0f, 1.0f, 2.0f);
    r.ramp(3000, 60.0f, 0.0f, 1.7f, 2.0f);    // sustained ~0.7 g decel, no spike
    r.run(3000, 0.0f, 1.0f, 2.0f);
    TEST_ASSERT_EQUAL(0, r.count(Event::IMPACT_TRIGGERED));
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_low_speed_knock_is_ignored() {
    Replay r;
    r.run(3000, 8.0f, 1.0f, 2.0f);            // walking pace / parked
    r.run(50,   8.0f, 7.0f, 2.0f);            // someone kicks the bike
    r.run(1000, 0.0f, 1.0f, 2.0f);
    TEST_ASSERT_EQUAL(0, r.count(Event::IMPACT_TRIGGERED));
}

void test_two_wheeler_crash_full_sequence() {
    Replay r;
    r.run(3000, 45.0f, 1.0f, 2.0f);           // cruise
    r.run(50,   45.0f, 9.0f, 10.0f);          // impact
    r.ramp(600, 45.0f, 0.0f, 2.5f, 40.0f);    // speed collapses within ~0.6 s
    r.run(400,  0.0f, 1.2f, 70.0f);           // still inside the 1 s window
    TEST_ASSERT_EQUAL(1, r.count(Event::IMPACT_TRIGGERED));
    TEST_ASSERT_EQUAL(State::POST_IMPACT_CHECK, r.det.state());

    r.run(2100, 0.0f, 1.0f, 80.0f);           // on its side > 2 s
    TEST_ASSERT_EQUAL(1, r.count(Event::CRASH_CONFIRMED));
    TEST_ASSERT_EQUAL(State::COUNTDOWN, r.det.state());
    TEST_ASSERT_EQUAL_FLOAT(45.0f, r.det.incident().preImpactSpeedKmh);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 9.0f, r.det.incident().peakG);
    TEST_ASSERT_TRUE(r.det.countdownRemainingSec(r.now) >= 14);

    r.run(15000, 0.0f, 1.0f, 80.0f);          // nobody cancels
    TEST_ASSERT_EQUAL(1, r.count(Event::ALERT));
    TEST_ASSERT_EQUAL(0, r.count(Event::CANCELLED));
    TEST_ASSERT_EQUAL(State::COOLDOWN, r.det.state());

    r.run(31000, 0.0f, 1.0f, 2.0f);           // bike picked up, cooldown passes
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_cancel_button_stops_alert() {
    Replay r;
    r.run(3000, 50.0f, 1.0f, 2.0f);
    r.run(50,   50.0f, 8.0f, 10.0f);
    r.ramp(500, 50.0f, 0.0f, 2.0f, 50.0f);
    r.run(500,  0.0f, 1.0f, 75.0f);
    r.run(2100, 0.0f, 1.0f, 75.0f);
    TEST_ASSERT_EQUAL(State::COUNTDOWN, r.det.state());

    r.run(5000, 0.0f, 1.0f, 75.0f);           // 5 s into the countdown...
    r.run(100,  0.0f, 1.0f, 75.0f, true);     // ...rider presses cancel
    TEST_ASSERT_EQUAL(1, r.count(Event::CANCELLED));
    TEST_ASSERT_EQUAL(State::COOLDOWN, r.det.state());

    r.run(20000, 0.0f, 1.0f, 75.0f);          // make sure no late ALERT fires
    TEST_ASSERT_EQUAL(0, r.count(Event::ALERT));
}

void test_crash_but_stays_upright_is_rejected() {
    // e.g. hit something and stopped, but bike remained upright on its stand.
    Replay r;
    r.run(3000, 40.0f, 1.0f, 2.0f);
    r.run(50,   40.0f, 8.0f, 5.0f);
    r.ramp(500, 40.0f, 0.0f, 2.0f, 5.0f);
    r.run(9000, 0.0f, 1.0f, 8.0f);            // upright for longer than the stage-3 timeout
    TEST_ASSERT_EQUAL(1, r.count(Event::REJECTED_ORIENTATION));
    TEST_ASSERT_EQUAL(0, r.count(Event::CRASH_CONFIRMED));
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
}

void test_tilt_must_be_continuous() {
    Replay r;
    r.run(3000, 40.0f, 1.0f, 2.0f);
    r.run(50,   40.0f, 8.0f, 5.0f);
    r.ramp(500, 40.0f, 0.0f, 2.0f, 30.0f);
    r.run(500,  0.0f, 1.0f, 70.0f);
    // Tilt flickers: 1.5 s over, 0.3 s under, 1.5 s over -> hold timer must restart
    r.run(1500, 0.0f, 1.0f, 70.0f);
    r.run(300,  0.0f, 1.0f, 20.0f);
    r.run(1500, 0.0f, 1.0f, 70.0f);
    TEST_ASSERT_EQUAL(0, r.count(Event::CRASH_CONFIRMED));
    r.run(600,  0.0f, 1.0f, 70.0f);           // now continuous for > 2 s
    TEST_ASSERT_EQUAL(1, r.count(Event::CRASH_CONFIRMED));
}

void test_four_wheeler_uses_stationary_check() {
    DetectorConfig c;
    c.vehicleType = VehicleType::FOUR_WHEELER;
    Replay r(c);
    r.run(3000, 60.0f, 1.0f, 0.0f);
    r.run(50,   60.0f, 10.0f, 0.0f);
    r.ramp(400, 60.0f, 0.0f, 3.0f, 0.0f);
    r.run(600,  0.0f, 1.0f, 0.0f);            // tilt stays 0 — car is upright
    r.run(3100, 0.0f, 1.0f, 0.0f);            // but stationary for > 3 s
    TEST_ASSERT_EQUAL(1, r.count(Event::CRASH_CONFIRMED));
    TEST_ASSERT_EQUAL(State::COUNTDOWN, r.det.state());
}

void test_reset_clears_everything() {
    Replay r;
    r.run(3000, 40.0f, 1.0f, 2.0f);
    r.run(50,   40.0f, 8.0f, 5.0f);
    TEST_ASSERT_EQUAL(State::IMPACT_CHECK, r.det.state());
    r.det.reset();
    TEST_ASSERT_EQUAL(State::NORMAL, r.det.state());
    TEST_ASSERT_EQUAL_FLOAT(0.0f, r.det.incident().peakG);
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_normal_riding_never_triggers);
    RUN_TEST(test_pothole_is_rejected_by_speed_check);
    RUN_TEST(test_speed_breaker_is_rejected);
    RUN_TEST(test_hard_braking_never_triggers);
    RUN_TEST(test_low_speed_knock_is_ignored);
    RUN_TEST(test_two_wheeler_crash_full_sequence);
    RUN_TEST(test_cancel_button_stops_alert);
    RUN_TEST(test_crash_but_stays_upright_is_rejected);
    RUN_TEST(test_tilt_must_be_continuous);
    RUN_TEST(test_four_wheeler_uses_stationary_check);
    RUN_TEST(test_reset_clears_everything);
    return UNITY_END();
}
