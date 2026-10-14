/**
 * Imu — minimal MPU6050 driver + mounting-independent tilt estimation.
 *
 * Why not just use roll/pitch? The unit may be mounted at any angle inside a
 * speedometer pod. Instead we:
 *   1. Record the gravity unit-vector g_ref while the vehicle is upright at boot.
 *   2. Track an estimated gravity vector g_est in the body frame using the gyro
 *      (dg/dt = -ω × g) and nudge it towards the accelerometer reading (2 %).
 *   3. tilt = angle between g_est and g_ref.
 * This is a complementary filter: 98 % gyro, 2 % accelerometer.
 *
 * The accelerometer is configured for ±16 g with the ~44 Hz digital low-pass
 * filter to suppress engine vibration. The impact magnitude |a| is
 * orientation independent.
 */
#pragma once

#include <Arduino.h>
#include <Wire.h>

struct ImuSample {
    float ax, ay, az;   // g
    float gx, gy, gz;   // deg/s
    float magG;         // sqrt(ax² + ay² + az²)
    float tiltDeg;      // deviation from the upright reference
};

class Imu {
public:
    /** Returns false if the MPU6050 does not answer on the bus. */
    bool begin(TwoWire& wire, uint8_t addr = 0x68);

    /** Average the gravity vector for `ms` while the unit is still -> upright reference. */
    void calibrateUpright(uint32_t ms);

    /** Reads a new sample if the sample period has elapsed. Returns true when a new sample is ready. */
    bool update();

    const ImuSample& sample() const { return s_; }
    bool  ok()                const { return ok_; }
    bool  calibrated()        const { return calibrated_; }

private:
    bool readRaw(int16_t* out7);
    void write8(uint8_t reg, uint8_t val);

    TwoWire* wire_ = nullptr;
    uint8_t  addr_ = 0x68;
    bool     ok_ = false, calibrated_ = false;

    ImuSample s_{};
    float gRef_[3] = {0, 0, 1};
    float gEst_[3] = {0, 0, 1};
    float gyroBias_[3] = {0, 0, 0};
    uint32_t lastSampleUs_ = 0;
    uint32_t samplePeriodUs_ = 10000;
};
