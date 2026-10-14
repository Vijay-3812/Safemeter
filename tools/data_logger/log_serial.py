#!/usr/bin/env python3
"""
Log raw SafeMeter sensor data from the serial port to a labelled CSV file.

The firmware prints CSV rows when logging is enabled (send 'L' over serial):
    t_ms,speed_kmh,ax,ay,az,gx,gy,gz,mag_g,tilt_deg,state

Usage:
    python log_serial.py --port /dev/ttyUSB0 --label pothole --trial 1
    python log_serial.py --port COM5 --label crash --trial 7 --seconds 20

Labels used by the analysis scripts: normal, pothole, speed_breaker, braking, crash
Files are written to data/raw/<label>_<trial>_<timestamp>.csv
"""
import argparse
import datetime as dt
import pathlib
import sys
import time

try:
    import serial  # pyserial
except ImportError:
    sys.exit("pyserial not installed: pip install -r tools/requirements.txt")

HEADER = "t_ms,speed_kmh,ax,ay,az,gx,gy,gz,mag_g,tilt_deg,state"
LABELS = ["normal", "pothole", "speed_breaker", "braking", "crash"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", required=True, help="serial port, e.g. /dev/ttyUSB0 or COM5")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--label", required=True, choices=LABELS, help="what this trial is")
    ap.add_argument("--trial", type=int, default=1, help="trial number for this label")
    ap.add_argument("--seconds", type=float, default=15.0, help="how long to record")
    ap.add_argument("--out", default="data/raw", help="output directory")
    args = ap.parse_args()

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"{args.label}_{args.trial:02d}_{stamp}.csv"

    with serial.Serial(args.port, args.baud, timeout=1) as ser, open(out_path, "w") as f:
        ser.reset_input_buffer()
        ser.write(b"L")  # enable logging on the device
        f.write(HEADER + ",label\n")
        print(f"Recording {args.seconds:.0f}s of '{args.label}' to {out_path} ... perform the event now")
        t_end = time.time() + args.seconds
        rows = 0
        while time.time() < t_end:
            line = ser.readline().decode(errors="ignore").strip()
            if not line or line.startswith("#") or line.startswith("[") or line.startswith("t_ms"):
                continue
            parts = line.split(",")
            if len(parts) != 11:
                continue
            f.write(line + f",{args.label}\n")
            rows += 1
        ser.write(b"L")  # disable logging again
    print(f"Saved {rows} rows -> {out_path}")


if __name__ == "__main__":
    main()
