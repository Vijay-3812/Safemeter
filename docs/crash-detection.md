# Crash detection — algorithm notes

## Why three stages

A single accelerometer threshold cannot tell a crash from a pothole: both produce a sharp spike,
and on Indian roads a pothole at 40 km/h can easily exceed 4 g at the frame. What differs is what
happens **after** the spike:

| | Pothole / breaker | Hard braking | Crash |
|---|---|---|---|
| Spike | yes, < 100 ms | no (sustained 0.5–0.8 g) | yes, large, followed by vibration |
| Wheel speed 1 s later | unchanged | falling gradually | collapsed (≥ 60 % drop) |
| Orientation 2 s later | upright | upright | on its side (2W) / stationary (4W) |

So the detector requires all three signatures in sequence. Each stage is cheap to compute and
has one or two tunable numbers.

## Parameters

Defined in [`firmware/include/config.h`](../firmware/include/config.h) and mirrored in
[`DetectorConfig`](../firmware/lib/CrashDetector/CrashDetector.h).

| Parameter | Default | Meaning | How to tune |
|-----------|---------|---------|-------------|
| `impactThresholdG` | 4.0 g | Stage-1 trigger on \|a\| | Set just above the largest pothole peak you log. Bench values are low; real crashes are > 20 g, so production uses a high-g sensor and a higher threshold. |
| `minSpeedKmh` | 20 | Ignore knocks while parked / walking pace | Lower if you want low-speed falls (but expect more nuisance triggers) |
| `speedCheckWindowMs` | 1000 | How long after impact to evaluate speed | 0.8–1.5 s |
| `speedDropRatio` | 0.60 | Required drop vs. pre-impact max | A locked wheel in a crash gives ~1.0; potholes give ~0.05 |
| `preImpactLookbackMs` | 1000 | Window for "speed before impact" | Protects against wheel lock *during* the impact |
| `tiltThresholdDeg` | 60° | "On its side" | Leaning in a corner is < 45° |
| `tiltHoldMs` | 2000 | Tilt must persist | Filters bouncing / a rider picking the bike up instantly |
| `stationarySpeedKmh` / `stationaryHoldMs` | 2 km/h / 3000 | Four-wheeler stage 3 | |
| `postImpactTimeoutMs` | 8000 | Give up waiting for stage 3 | |
| `countdownMs` | 15000 | Cancel window | Fixed by the concept |
| `cooldownMs` | 30000 | Ignore re-triggers after alert/cancel | |

## Signal processing

**Impact magnitude.** \|a\| = √(ax² + ay² + az²) in g, from the MPU6050 at 100 Hz with the
on-chip DLPF at ~44 Hz. Magnitude is orientation-free, so the unit can be mounted at any angle.

**Tilt.** Rather than roll/pitch (which assume a known mounting), the firmware tracks the
**gravity vector in the body frame**:

1. At boot, average 1.5 s of accelerometer data → upright reference `g_ref` (unit vector), and
   gyro bias.
2. Each sample: predict `g_est` from the gyro (`dg/dt = −ω × g`), then blend 2 % of the
   normalised accelerometer vector back in — but only when \|a\| is within 0.6–1.4 g, so the
   impact itself doesn't corrupt the estimate.
3. `tilt = acos(g_est · g_ref)`.

This is the classic complementary filter (98 % gyro / 2 % accel) expressed on vectors.
Code: [`imu.cpp`](../firmware/src/imu.cpp).

**Speed.** Hall-sensor pulse period → km/h, with a 3 ms debounce and 2 s timeout. GPS speed is
the fallback if the hall sensor gives no signal (`USE_GPS_SPEED_FALLBACK`). The detector keeps a
3 s rolling history to compute the pre-impact maximum.

## Testing the logic without hardware

```bash
cd firmware
pio test -e native
```

Eleven scenarios (cruising, pothole, speed breaker, hard braking, low-speed knock, full crash,
cancel, upright-after-impact, flickering tilt, four-wheeler, reset) replay synthetic rides through
the detector at 100 Hz. Add new cases to
[`test_crash_detector.cpp`](../firmware/test/test_native/test_crash_detector.cpp) whenever a
field recording exposes a gap.

You can also trigger the state machine from the serial console on real hardware:
`T` simulates an impact at 45 km/h, `C` simulates the cancel button.

## Tuning from logged data

1. Record ≥ 20 potholes, ≥ 15 braking events, ≥ 15 bench crashes with
   `tools/data_logger/log_serial.py --label …`.
2. Run `python tools/analysis/evaluate.py data/raw`. It prints per-class feature means, the
   confusion matrix for the current thresholds, and a 3-level decision tree for comparison.
3. Try alternative thresholds with `--impact-g`, `--drop`, `--tilt` flags; pick the set with zero
   false alarms and the highest detection rate; copy them into `config.h`.
4. Report both the rules and the tree results in the submission, even if the tree doesn't help.

## Known gaps

- **MPU6050 saturates at 16 g.** Peak-g is therefore clipped in a real crash; the detector still
  works because stages 2–3 don't depend on the peak value. Production: ADXL375 (±200 g).
- **Rider thrown clear, bike upright.** A glancing collision where the bike stays on its stand is
  rejected by stage 3. The four-wheeler "stationary" rule could be added as an OR for two-wheelers
  at the cost of more false positives (e.g. stopping suddenly after a pothole). Evaluate with data.
- **Slow-speed falls** (< 20 km/h, e.g. in traffic) are ignored by design — they are rarely
  life-threatening and would dominate false alarms.
