# SafeMeter firmware (ESP32)

PlatformIO project, Arduino framework. Non-blocking main loop; all crash logic lives in a
hardware-independent library so it can be tested on a PC.

```
firmware/
├── platformio.ini               esp32dev (target) + native (unit tests)
├── include/
│   ├── config.h                 pins, wheel size, thresholds, timings
│   └── secrets.example.h        → copy to secrets.h: emergency numbers, Wi-Fi, backend key
├── lib/CrashDetector/           3-stage state machine (no Arduino deps)
├── src/
│   ├── main.cpp                 wiring of modules, serial commands, display logic
│   ├── speed_sensor.*           hall-sensor ISR → km/h, rolling history
│   ├── imu.*                    MPU6050 driver, |a|, vector complementary filter → tilt
│   ├── gps.*                    TinyGPS++ wrapper, last-known-fix, Maps link
│   ├── gsm.*                    SIM800L non-blocking SMS queue, store-and-forward
│   ├── display.*                SSD1306 screens (speed / countdown / alert / cancelled)
│   └── alert.*                  SMS + JSON composition, optional HTTPS push
└── test/test_native/            Unity tests for the detector (pio test -e native)
```

## Build & flash

```bash
pip install platformio
cp include/secrets.example.h include/secrets.h     # edit numbers
pio run -e esp32dev                                 # build
pio run -e esp32dev -t upload                       # flash (hold BOOT on some boards)
pio device monitor                                  # 115200 baud
```

If `secrets.h` is missing the build still succeeds with the placeholder numbers from
`secrets.example.h` (a compiler warning reminds you).

## Serial console

| Key | Action |
|-----|--------|
| `L` | Toggle CSV logging: `t_ms,speed_kmh,ax,ay,az,gx,gy,gz,mag_g,tilt_deg,state` at 50 Hz |
| `T` | Simulate an impact trigger (pretends 45 km/h if the wheel is still) — bench demo |
| `C` | Simulate the cancel button |
| `S` | Print status line (state, speed, tilt, GPS, GSM, queue) |

Detector events are printed as `[DET] <ms> <EVENT> -> <STATE> (pre=.. km/h peak=.. g tilt=..)`.

## Unit tests

```bash
pio test -e native
```

Runs 11 replayed scenarios through `CrashDetector` at 100 Hz: cruising, pothole, speed breaker,
hard braking, low-speed knock, full crash → alert, cancel, upright-after-impact rejection,
flickering tilt, four-wheeler stationary rule, reset.

## Configuration highlights (`include/config.h`)

| Define | Default | Note |
|--------|---------|------|
| `WHEEL_CIRCUMFERENCE_M` | 1.95 | **Measure your wheel** |
| `MAGNETS_PER_REV` | 1 | More magnets = better low-speed resolution |
| `DET_VEHICLE_TWO_WHEELER` | 1 | 0 → four-wheeler (stationary check instead of tilt) |
| `DET_IMPACT_THRESHOLD_G` | 4.0 | Bench value; tune from logs |
| `ALERT_PUSH_TO_BACKEND` | 0 | 1 → also POST to Firebase over Wi-Fi (needs secrets.h) |
| `LOG_DEFAULT_ENABLED` | 0 | 1 → start logging at boot |

## Power-up sequence

1. OLED "SafeMeter – Starting sensors…"
2. "Hold still: calibrating upright" (1.5 s) — the unit learns which way is up, so mounting
   orientation doesn't matter. **Keep the vehicle upright and still during this.**
3. Short beep → speed screen. GPS needs sky; the header shows satellite count and GSM bars.

## Memory (esp32dev)

Flash ≈ 322 KB / 1.3 MB · RAM ≈ 25 KB / 320 KB (with Wi-Fi/HTTP disabled).
