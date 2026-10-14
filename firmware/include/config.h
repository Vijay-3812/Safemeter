/**
 * SafeMeter firmware configuration — pins, hardware constants, thresholds.
 *
 * Copy `secrets.example.h` to `secrets.h` and fill in your emergency contact
 * numbers and (optional) Wi-Fi / backend credentials. `secrets.h` is
 * git-ignored so phone numbers never end up in the repository.
 */
#pragma once

#include <stdint.h>

// ============================================================ Identity
#define SM_VEHICLE_ID            "SM-001"          // printed in every SMS / backend event
#define SM_FIRMWARE_VERSION      "0.1.0"

// ============================================================ Pins (ESP32 DevKit)
// I2C bus shared by the MPU6050 (0x68) and the OLED (0x3C)
#define PIN_I2C_SDA              21
#define PIN_I2C_SCL              22

// NEO-6M GPS on UART2
#define PIN_GPS_RX               16   // ESP32 RX  <- GPS TX
#define PIN_GPS_TX               17   // ESP32 TX  -> GPS RX
#define GPS_BAUD                 9600

// SIM800L GSM on UART1 (remapped). Use a level shifter / divider on SIM800L RX!
#define PIN_GSM_RX               26   // ESP32 RX  <- SIM800L TX
#define PIN_GSM_TX               27   // ESP32 TX  -> SIM800L RX (via divider)
#define GSM_BAUD                 9600

// Hall-effect wheel sensor (interrupt capable, input-only pin is fine)
#define PIN_HALL                 34

// Cancel button (to GND, internal pull-up) and buzzer
#define PIN_BUTTON               32
#define PIN_BUZZER               25

// ============================================================ Wheel / speed
#define WHEEL_CIRCUMFERENCE_M    1.95f  // measure your wheel! (e.g. 110/70-17 ≈ 1.95 m)
#define MAGNETS_PER_REV          1      // add more magnets for better low-speed resolution
#define HALL_DEBOUNCE_US         3000   // ignore pulses closer than this (3 ms)
#define SPEED_TIMEOUT_MS         2000   // no pulse for this long -> speed = 0
#define USE_GPS_SPEED_FALLBACK   1      // use GPS speed if the hall sensor is silent

// ============================================================ IMU
#define IMU_SAMPLE_HZ            100
#define IMU_I2C_ADDR             0x68
#define IMU_CALIBRATION_MS       1500   // keep the unit still this long at power-up
#define TILT_FILTER_ALPHA        0.98f  // complementary filter: 98 % gyro, 2 % accel

// ============================================================ Crash detection
// These are PROTOTYPE values for bench testing — tune them from logged data.
// Production units should use a high-g sensor (ADXL375 / H3LIS331DL).
#define DET_VEHICLE_TWO_WHEELER  1      // 0 = four-wheeler (stationary check instead of tilt)
#define DET_IMPACT_THRESHOLD_G   4.0f
#define DET_MIN_SPEED_KMH        20.0f
#define DET_SPEED_WINDOW_MS      1000
#define DET_SPEED_DROP_RATIO     0.60f
#define DET_TILT_THRESHOLD_DEG   60.0f
#define DET_TILT_HOLD_MS         2000
#define DET_STATIONARY_HOLD_MS   3000
#define DET_POST_IMPACT_TIMEOUT  8000
#define DET_COUNTDOWN_MS         15000
#define DET_COOLDOWN_MS          30000

// ============================================================ Display / UI
#define OLED_WIDTH               128
#define OLED_HEIGHT              64
#define OLED_I2C_ADDR            0x3C
#define DISPLAY_REFRESH_MS       200
#define BUTTON_DEBOUNCE_MS       40

// ============================================================ Alerting
#define SMS_MAX_RETRIES          3
#define SMS_RETRY_INTERVAL_MS    20000  // store-and-forward: retry when signal returns
#define ALERT_PUSH_TO_BACKEND    0      // 1 = also POST the event over Wi-Fi (see secrets.h)

// ============================================================ Data logging
// Send 'L' over serial to toggle CSV logging of raw sensor data (see tools/data_logger).
#define LOG_DEFAULT_ENABLED      0
#define LOG_RATE_HZ              50
