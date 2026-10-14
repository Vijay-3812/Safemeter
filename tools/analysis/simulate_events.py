#!/usr/bin/env python3
"""
Generate SYNTHETIC labelled sensor logs in the same CSV format as the firmware
logger, so the analysis pipeline can be developed and tested before real rig
data exists.

⚠ These traces are hand-modelled, not measured. Replace them with real logs
from tools/data_logger/log_serial.py before reporting any accuracy numbers.

Usage:
    python simulate_events.py --out data/synthetic --per-class 20
"""
import argparse
import pathlib

import numpy as np

HEADER = "t_ms,speed_kmh,ax,ay,az,gx,gy,gz,mag_g,tilt_deg,state,label"
HZ = 50


def base_trace(seconds, speed, rng):
    n = int(seconds * HZ)
    t = np.arange(n) * (1000 / HZ)
    sp = np.full(n, speed, dtype=float) + rng.normal(0, 0.4, n)
    # ~1 g with engine vibration on z, small noise on x/y
    ax = rng.normal(0, 0.05, n)
    ay = rng.normal(0, 0.05, n)
    az = 1.0 + rng.normal(0, 0.08, n) + 0.05 * np.sin(np.arange(n) * 1.3)
    gx = rng.normal(0, 2, n)
    gy = rng.normal(0, 2, n)
    gz = rng.normal(0, 2, n)
    tilt = np.abs(rng.normal(3, 1.0, n))
    return t, sp, ax, ay, az, gx, gy, gz, tilt


def spike(az, idx, peak, width):
    """Add a half-sine spike of given peak (g) and width (samples) at idx."""
    w = max(2, width)
    # interior points of a half-sine so a 2-sample spike is not [0, 0];
    # force one sample to the full peak so the logged maximum is meaningful
    s = np.sin(np.linspace(0, np.pi, w + 2)[1:-1]) * peak
    s[np.argmax(s)] = peak
    end = min(len(az), idx + w)
    az[idx:end] += s[: end - idx]


def make_event(label, rng):
    speed = rng.uniform(25, 70)
    t, sp, ax, ay, az, gx, gy, gz, tilt = base_trace(12, speed, rng)
    n = len(t)
    i0 = int(4 * HZ)  # event at t = 4 s

    if label == "normal":
        pass

    elif label == "pothole":
        spike(az, i0, rng.uniform(3.5, 7.0), int(rng.uniform(0.04, 0.10) * HZ))
        sp[i0:] -= rng.uniform(0, 2)           # barely slows

    elif label == "speed_breaker":
        spike(az, i0, rng.uniform(2.5, 5.0), int(0.08 * HZ))
        spike(az, i0 + int(0.4 * HZ), rng.uniform(2.5, 5.0), int(0.08 * HZ))
        dip = np.linspace(0, rng.uniform(3, 8), int(1.0 * HZ))
        sp[i0:i0 + len(dip)] -= dip
        sp[i0 + len(dip):] -= dip[-1] * 0.5     # recovers partially

    elif label == "braking":
        dur = int(rng.uniform(2.5, 4.0) * HZ)
        ramp = np.linspace(speed, 0, dur)
        sp[i0:i0 + dur] = ramp
        sp[i0 + dur:] = 0
        ax[i0:i0 + dur] -= rng.uniform(0.5, 0.8)   # sustained decel along travel axis
        gx[i0:i0 + dur] += rng.normal(0, 3, dur)

    elif label == "crash":
        peak = rng.uniform(6, 15)
        spike(az, i0, peak, int(rng.uniform(0.03, 0.08) * HZ))
        ax[i0:i0 + 3] += rng.uniform(-4, 4)
        # ringing / vibration after impact
        az[i0:i0 + HZ] += rng.normal(0, 0.8, HZ)
        # speed collapses within ~0.3-0.8 s
        dur = int(rng.uniform(0.3, 0.8) * HZ)
        sp[i0:i0 + dur] = np.linspace(speed, 0, dur)
        sp[i0 + dur:] = 0
        # falls over: tilt rises to 70-100° over ~0.5 s and stays
        rise = int(0.5 * HZ)
        final = rng.uniform(70, 100)
        tilt[i0:i0 + rise] = np.linspace(5, final, rise)
        tilt[i0 + rise:] = final + rng.normal(0, 1.5, n - i0 - rise)
        gx[i0:i0 + rise] += final / 0.5          # deg/s during the fall
        # gravity now mostly on another axis
        ay[i0 + rise:] += np.sin(np.radians(final))
        az[i0 + rise:] = np.cos(np.radians(final)) + rng.normal(0, 0.05, n - i0 - rise)

    sp = np.clip(sp, 0, None)
    mag = np.sqrt(ax**2 + ay**2 + az**2)
    state = np.zeros(n, dtype=int)
    return np.column_stack([t, sp, ax, ay, az, gx, gy, gz, mag, tilt, state])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/synthetic")
    ap.add_argument("--per-class", type=int, default=20)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    labels = ["normal", "pothole", "speed_breaker", "braking", "crash"]
    for label in labels:
        for k in range(args.per_class):
            arr = make_event(label, rng)
            path = out / f"{label}_{k + 1:02d}_synthetic.csv"
            with open(path, "w") as f:
                f.write(HEADER + "\n")
                for row in arr:
                    f.write(",".join(f"{v:.3f}" if i != 10 else str(int(v)) for i, v in enumerate(row)) + f",{label}\n")
    print(f"Wrote {len(labels) * args.per_class} synthetic traces to {out}/  (SYNTHETIC — not measured data)")


if __name__ == "__main__":
    main()
