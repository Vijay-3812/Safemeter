#include "imu.h"
#include "config.h"
#include <math.h>

// MPU6050 registers
static constexpr uint8_t REG_SMPLRT_DIV   = 0x19;
static constexpr uint8_t REG_CONFIG       = 0x1A;
static constexpr uint8_t REG_GYRO_CONFIG  = 0x1B;
static constexpr uint8_t REG_ACCEL_CONFIG = 0x1C;
static constexpr uint8_t REG_ACCEL_XOUT_H = 0x3B;
static constexpr uint8_t REG_PWR_MGMT_1   = 0x6B;
static constexpr uint8_t REG_WHO_AM_I     = 0x75;

static constexpr float ACCEL_LSB_PER_G    = 2048.0f;   // ±16 g full scale
static constexpr float GYRO_LSB_PER_DPS   = 16.4f;     // ±2000 °/s full scale

static inline void normalize3(float* v) {
    float n = sqrtf(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    if (n > 1e-6f) { v[0] /= n; v[1] /= n; v[2] /= n; }
}

void Imu::write8(uint8_t reg, uint8_t val) {
    wire_->beginTransmission(addr_);
    wire_->write(reg);
    wire_->write(val);
    wire_->endTransmission();
}

bool Imu::begin(TwoWire& wire, uint8_t addr) {
    wire_ = &wire;
    addr_ = addr;
    samplePeriodUs_ = 1000000UL / IMU_SAMPLE_HZ;

    wire_->beginTransmission(addr_);
    wire_->write(REG_WHO_AM_I);
    if (wire_->endTransmission(false) != 0) return false;
    wire_->requestFrom((int)addr_, 1);
    if (!wire_->available()) return false;
    uint8_t who = wire_->read();
    if (who != 0x68 && who != 0x72 && who != 0x70) {   // MPU6050 / MPU6500 / MPU9250 clones
        Serial.printf("[IMU] unexpected WHO_AM_I 0x%02X\n", who);
    }

    write8(REG_PWR_MGMT_1, 0x80);  delay(100);         // reset
    write8(REG_PWR_MGMT_1, 0x01);                      // wake, PLL with X gyro ref
    write8(REG_CONFIG, 0x03);                          // DLPF ≈ 44 Hz accel / 42 Hz gyro
    write8(REG_SMPLRT_DIV, 0x04);                      // 1 kHz / (1+4) = 200 Hz internal rate
    write8(REG_GYRO_CONFIG, 0x18);                     // ±2000 °/s
    write8(REG_ACCEL_CONFIG, 0x18);                    // ±16 g
    delay(50);
    ok_ = true;
    return true;
}

bool Imu::readRaw(int16_t* out7) {
    wire_->beginTransmission(addr_);
    wire_->write(REG_ACCEL_XOUT_H);
    if (wire_->endTransmission(false) != 0) return false;
    if (wire_->requestFrom((int)addr_, 14) != 14) return false;
    for (int i = 0; i < 7; ++i) {
        int16_t hi = wire_->read();
        int16_t lo = wire_->read();
        out7[i] = (int16_t)((hi << 8) | lo);
    }
    return true;
}

void Imu::calibrateUpright(uint32_t ms) {
    if (!ok_) return;
    double acc[3] = {0, 0, 0}, gyr[3] = {0, 0, 0};
    uint32_t n = 0;
    const uint32_t start = millis();
    int16_t raw[7];
    while (millis() - start < ms) {
        if (readRaw(raw)) {
            acc[0] += raw[0]; acc[1] += raw[1]; acc[2] += raw[2];
            gyr[0] += raw[4]; gyr[1] += raw[5]; gyr[2] += raw[6];
            n++;
        }
        delay(5);
    }
    if (n == 0) return;
    for (int i = 0; i < 3; ++i) {
        gRef_[i]     = (float)(acc[i] / n) / ACCEL_LSB_PER_G;
        gyroBias_[i] = (float)(gyr[i] / n) / GYRO_LSB_PER_DPS;
        gEst_[i]     = gRef_[i];
    }
    normalize3(gRef_);
    normalize3(gEst_);
    calibrated_   = true;
    lastSampleUs_ = micros();
    Serial.printf("[IMU] upright ref = (%.2f, %.2f, %.2f), %lu samples\n", gRef_[0], gRef_[1], gRef_[2], (unsigned long)n);
}

bool Imu::update() {
    if (!ok_) return false;
    const uint32_t nowUs = micros();
    if (nowUs - lastSampleUs_ < samplePeriodUs_) return false;
    const float dt = (nowUs - lastSampleUs_) / 1e6f;
    lastSampleUs_ = nowUs;

    int16_t raw[7];
    if (!readRaw(raw)) return false;

    s_.ax = raw[0] / ACCEL_LSB_PER_G;
    s_.ay = raw[1] / ACCEL_LSB_PER_G;
    s_.az = raw[2] / ACCEL_LSB_PER_G;
    s_.gx = raw[4] / GYRO_LSB_PER_DPS - gyroBias_[0];
    s_.gy = raw[5] / GYRO_LSB_PER_DPS - gyroBias_[1];
    s_.gz = raw[6] / GYRO_LSB_PER_DPS - gyroBias_[2];
    s_.magG = sqrtf(s_.ax*s_.ax + s_.ay*s_.ay + s_.az*s_.az);

    // --- Complementary filter on the gravity vector -------------------------
    // Gyro prediction: rotating the body by ω rotates gravity (in body frame) by -ω.
    //   dg/dt = -ω × g
    const float wx = s_.gx * (float)M_PI / 180.0f;
    const float wy = s_.gy * (float)M_PI / 180.0f;
    const float wz = s_.gz * (float)M_PI / 180.0f;
    float gp[3] = {
        gEst_[0] - (wy * gEst_[2] - wz * gEst_[1]) * dt,
        gEst_[1] - (wz * gEst_[0] - wx * gEst_[2]) * dt,
        gEst_[2] - (wx * gEst_[1] - wy * gEst_[0]) * dt,
    };
    normalize3(gp);

    // Accelerometer correction — only trust it when |a| ≈ 1 g (not mid-impact).
    float am[3] = { s_.ax, s_.ay, s_.az };
    normalize3(am);
    const float alpha = (s_.magG > 0.6f && s_.magG < 1.4f) ? TILT_FILTER_ALPHA : 1.0f;
    for (int i = 0; i < 3; ++i) gEst_[i] = alpha * gp[i] + (1.0f - alpha) * am[i];
    normalize3(gEst_);

    float dot = gEst_[0]*gRef_[0] + gEst_[1]*gRef_[1] + gEst_[2]*gRef_[2];
    if (dot > 1.0f) dot = 1.0f; else if (dot < -1.0f) dot = -1.0f;
    s_.tiltDeg = acosf(dot) * 180.0f / (float)M_PI;
    return true;
}
