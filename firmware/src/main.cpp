/**
 * SafeMeter — vehicle-powered smart speedometer with crash detection.
 *
 * Main loop wiring:
 *
 *   hall ISR ─► SpeedSensor ─┐
 *   MPU6050  ─► Imu ─────────┼─► CrashDetector ─► events ─► Display / Buzzer / Alert ─► Gsm (SMS)
 *   NEO-6M   ─► Gps ─────────┘                                               └► backend (optional)
 *
 * Everything is non-blocking (timers + interrupts), so the display, GPS parsing
 * and sensor sampling keep running during the countdown and while SMS are sent.
 *
 * Serial commands (115200 baud):
 *   L  toggle CSV data logging        (see tools/data_logger)
 *   T  simulate an impact trigger     (bench demo without hitting the rig)
 *   C  simulate the cancel button
 *   S  print status
 */
#include <Arduino.h>
#include <Wire.h>

#include "config.h"
#include "CrashDetector.h"
#include "speed_sensor.h"
#include "imu.h"
#include "gps.h"
#include "gsm.h"
#include "display.h"
#include "alert.h"

using namespace safemeter;

// ------------------------------------------------------------------ objects
static SpeedSensor   speedSensor;
static Imu           imu;
static Gps           gps;
static Gsm           gsm;
static Display       display;
static Alert         alert;
static CrashDetector detector;

static HardwareSerial GpsSerial(2);
static HardwareSerial GsmSerial(1);

// ------------------------------------------------------------------ state
static bool     logEnabled      = LOG_DEFAULT_ENABLED;
static uint32_t lastLogMs       = 0;
static uint32_t lastDisplayMs   = 0;
static bool     simulateImpact  = false;
static bool     simulateCancel  = false;
static uint32_t alertShownAt    = 0;
static uint32_t cancelShownAt   = 0;

// Buzzer: beep pattern during countdown, controlled from loop()
static void buzzerUpdate(State st, uint32_t now) {
    static bool on = false;
    if (st == State::COUNTDOWN) {
        bool want = (now % 500) < 250;           // 2 Hz beep
        if (want != on) { digitalWrite(PIN_BUZZER, want); on = want; }
    } else if (on) {
        digitalWrite(PIN_BUZZER, LOW); on = false;
    }
}

// Button with simple debounce. Returns true while a debounced press is active.
static bool buttonPressed() {
    static bool     stable = false;
    static bool     lastRaw = false;
    static uint32_t lastChange = 0;
    bool raw = digitalRead(PIN_BUTTON) == LOW;   // active low (to GND, pull-up)
    if (raw != lastRaw) { lastRaw = raw; lastChange = millis(); }
    if (millis() - lastChange > BUTTON_DEBOUNCE_MS) stable = raw;
    return stable;
}

static DetectorConfig makeDetectorConfig() {
    DetectorConfig c;
    c.vehicleType        = DET_VEHICLE_TWO_WHEELER ? VehicleType::TWO_WHEELER : VehicleType::FOUR_WHEELER;
    c.impactThresholdG   = DET_IMPACT_THRESHOLD_G;
    c.minSpeedKmh        = DET_MIN_SPEED_KMH;
    c.speedCheckWindowMs = DET_SPEED_WINDOW_MS;
    c.speedDropRatio     = DET_SPEED_DROP_RATIO;
    c.tiltThresholdDeg   = DET_TILT_THRESHOLD_DEG;
    c.tiltHoldMs         = DET_TILT_HOLD_MS;
    c.stationaryHoldMs   = DET_STATIONARY_HOLD_MS;
    c.postImpactTimeoutMs= DET_POST_IMPACT_TIMEOUT;
    c.countdownMs        = DET_COUNTDOWN_MS;
    c.cooldownMs         = DET_COOLDOWN_MS;
    return c;
}

static void handleSerialCommands() {
    while (Serial.available()) {
        char c = (char)Serial.read();
        switch (c) {
            case 'L': case 'l':
                logEnabled = !logEnabled;
                Serial.printf("# logging %s\n", logEnabled ? "ON" : "OFF");
                if (logEnabled) Serial.println("t_ms,speed_kmh,ax,ay,az,gx,gy,gz,mag_g,tilt_deg,state");
                break;
            case 'T': case 't': simulateImpact = true; Serial.println("# simulated impact"); break;
            case 'C': case 'c': simulateCancel = true; Serial.println("# simulated cancel"); break;
            case 'S': case 's': {
                GpsFix f = gps.fix();
                Serial.printf("# state=%s speed=%.1f tilt=%.1f g=%.2f gps=%d sats=%d gsm=%d reg=%d csq=%d pending=%d sent=%lu\n",
                    CrashDetector::stateName(detector.state()), speedSensor.speedKmh(),
                    imu.sample().tiltDeg, imu.sample().magG, f.valid, f.satellites,
                    gsm.ready(), gsm.registered(), gsm.signalCsq(), gsm.pending(), (unsigned long)gsm.sentCount());
                break;
            }
            default: break;
        }
    }
}

static void logCsv(uint32_t now, float speed) {
    if (!logEnabled || now - lastLogMs < (1000 / LOG_RATE_HZ)) return;
    lastLogMs = now;
    const ImuSample& s = imu.sample();
    Serial.printf("%lu,%.2f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.3f,%.1f,%d\n",
                  (unsigned long)now, speed, s.ax, s.ay, s.az, s.gx, s.gy, s.gz,
                  s.magG, s.tiltDeg, (int)detector.state());
}

// ------------------------------------------------------------------ setup
void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.printf("\nSafeMeter fw %s  vehicle %s\n", SM_FIRMWARE_VERSION, SM_VEHICLE_ID);

    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);
    pinMode(PIN_BUTTON, INPUT_PULLUP);

    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);

    display.begin(Wire, OLED_I2C_ADDR);
    display.showBoot("Starting sensors...");

    speedSensor.begin(PIN_HALL, WHEEL_CIRCUMFERENCE_M, MAGNETS_PER_REV);
    gps.begin(GpsSerial, PIN_GPS_RX, PIN_GPS_TX, GPS_BAUD);
    gsm.begin(GsmSerial, PIN_GSM_RX, PIN_GSM_TX, GSM_BAUD);
    alert.begin(gsm, gps);
    detector.setConfig(makeDetectorConfig());

    if (!imu.begin(Wire, IMU_I2C_ADDR)) {
        Serial.println("[IMU] MPU6050 not found - check wiring (SDA 21 / SCL 22)");
        display.showBoot("IMU not found!", "check SDA21/SCL22");
    } else {
        display.showBoot("Hold still:", "calibrating upright");
        imu.calibrateUpright(IMU_CALIBRATION_MS);
    }

    // Short beep = ready
    digitalWrite(PIN_BUZZER, HIGH); delay(80); digitalWrite(PIN_BUZZER, LOW);
    display.showBoot("Ready", "waiting for GPS fix");
    Serial.println("Ready. Commands: L=log T=trigger C=cancel S=status");
}

// ------------------------------------------------------------------ loop
void loop() {
    const uint32_t now = millis();

    handleSerialCommands();
    speedSensor.update();
    gps.update();
    gsm.update();
    alert.update();
    bool newImu = imu.update();

    // Effective speed: hall sensor first, GPS as fallback when the sensor is silent.
    float speed = speedSensor.speedKmh();
#if USE_GPS_SPEED_FALLBACK
    if (!speedSensor.hasSignal() && gps.hasFix()) speed = gps.fix().speedKmh;
#endif

    // Run the detector once per IMU sample (100 Hz)
    if (newImu || simulateImpact || simulateCancel) {
        const ImuSample& s = imu.sample();
        float g    = simulateImpact ? (DET_IMPACT_THRESHOLD_G + 2.0f) : s.magG;
        float tilt = s.tiltDeg;
        bool  cancel = buttonPressed() || simulateCancel;
        // When simulating from the serial console, pretend we were moving.
        if (simulateImpact && speed < DET_MIN_SPEED_KMH) speed = 45.0f;
        simulateImpact = false;
        simulateCancel = false;

        Event ev = detector.tick(now, speed, g, tilt, cancel);
        if (ev != Event::NONE) {
            Serial.printf("[DET] %lu %s -> %s (pre=%.1f km/h peak=%.1f g tilt=%.0f)\n",
                          (unsigned long)now, CrashDetector::eventName(ev),
                          CrashDetector::stateName(detector.state()),
                          detector.incident().preImpactSpeedKmh, detector.incident().peakG,
                          detector.incident().maxTiltDeg);
        }
        switch (ev) {
            case Event::ALERT:
                alert.dispatch(detector.incident(), "alerted");
                alertShownAt = now;
                break;
            case Event::CANCELLED:
                alert.dispatch(detector.incident(), "cancelled");   // backend log only, no SMS
                cancelShownAt = now;
                break;
            case Event::CRASH_CONFIRMED:
                // Countdown screen + buzzer handled below
                break;
            default: break;
        }
        logCsv(now, speed);
    }

    buzzerUpdate(detector.state(), now);

    // ------------------------------------------------------------ display
    if (now - lastDisplayMs >= DISPLAY_REFRESH_MS) {
        lastDisplayMs = now;
        State st = detector.state();
        GpsFix f = gps.fix();
        StatusInfo si;
        si.gpsFix = f.valid; si.satellites = f.satellites;
        si.gsmReady = gsm.ready(); si.gsmRegistered = gsm.registered(); si.csq = gsm.signalCsq();
        si.imuOk = imu.ok(); si.hallSignal = speedSensor.hasSignal();
        si.tiltDeg = imu.sample().tiltDeg; si.accelG = imu.sample().magG;

        switch (st) {
            case State::COUNTDOWN:
                display.showCountdown(detector.countdownRemainingSec(now));
                break;
            case State::IMPACT_CHECK:
                display.showImpactCheck("checking speed...");
                break;
            case State::POST_IMPACT_CHECK:
                display.showImpactCheck("checking orientation...");
                break;
            case State::COOLDOWN:
                if (alertShownAt && now - alertShownAt < DET_COOLDOWN_MS)       display.showAlertSent(gsm.pending());
                else if (cancelShownAt && now - cancelShownAt < 4000)           display.showCancelled();
                else                                                            display.showSpeed(speed, si);
                break;
            default:
                display.showSpeed(speed, si);
                break;
        }
    }
}
