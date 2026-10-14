#!/usr/bin/env python3
"""
Evaluate crash-detection rules against labelled sensor logs.

For every CSV trace it extracts event features around the acceleration peak,
then compares:

  1. RULES  — the firmware's three-stage thresholds (impact g, speed drop, tilt hold)
  2. TREE   — a small decision tree trained on the same features (5-fold CV)

and prints confusion matrices, false-alarm rate, detection rate, and the learned
tree so you can see whether ML adds anything over hand-set thresholds. Report
both honestly, including when the thresholds perform equally well.

Usage:
    python evaluate.py data/raw                 # real logs from log_serial.py
    python evaluate.py data/synthetic           # synthetic traces (pipeline test)
    python evaluate.py data/raw --impact-g 5 --drop 0.5 --tilt 55
"""
import argparse
import glob
import os
import sys

import numpy as np
import pandas as pd

CRASH = "crash"
FEATURES = ["peak_g", "spike_ms", "speed_before", "speed_after_1s", "speed_drop", "max_tilt_after", "tilt_hold_ms", "decel_g"]


def extract_features(df):
    """One feature row per trace, computed around the largest |a| sample."""
    t = df["t_ms"].to_numpy()
    mag = df["mag_g"].to_numpy()
    sp = df["speed_kmh"].to_numpy()
    tilt = df["tilt_deg"].to_numpy()
    ax = df["ax"].to_numpy()

    i_peak = int(np.argmax(mag))
    t_peak = t[i_peak]

    # how long |a| stays above 2 g around the peak
    above = mag > 2.0
    j = i_peak
    while j > 0 and above[j - 1]:
        j -= 1
    k = i_peak
    while k < len(mag) - 1 and above[k + 1]:
        k += 1
    spike_ms = float(t[k] - t[j]) if above[i_peak] else 0.0

    before = (t >= t_peak - 1000) & (t < t_peak)
    speed_before = float(sp[before].max()) if before.any() else float(sp[i_peak])
    at_1s = np.searchsorted(t, t_peak + 1000)
    speed_after = float(sp[min(at_1s, len(sp) - 1)])
    drop = (speed_before - speed_after) / speed_before if speed_before > 0 else 0.0

    after = t > t_peak
    max_tilt_after = float(tilt[after].max()) if after.any() else float(tilt[i_peak])
    # longest continuous run of tilt >= 60° after the peak
    hold, best = 0.0, 0.0
    dt = float(np.median(np.diff(t))) if len(t) > 1 else 20.0
    for v in tilt[after]:
        if v >= 60:
            hold += dt
            best = max(best, hold)
        else:
            hold = 0.0

    decel = float(np.abs(ax[(t >= t_peak) & (t <= t_peak + 2000)]).mean()) if after.any() else 0.0

    return dict(peak_g=float(mag[i_peak]), spike_ms=spike_ms, speed_before=speed_before,
                speed_after_1s=speed_after, speed_drop=drop, max_tilt_after=max_tilt_after,
                tilt_hold_ms=best, decel_g=decel)


def rules_predict(f, impact_g, min_speed, drop, tilt, tilt_hold_ms):
    """Mirror of firmware/lib/CrashDetector: all three stages must pass."""
    stage1 = f["peak_g"] >= impact_g and f["speed_before"] >= min_speed
    stage2 = f["speed_drop"] >= drop
    stage3 = f["tilt_hold_ms"] >= tilt_hold_ms and f["max_tilt_after"] >= tilt
    return stage1 and stage2 and stage3


def confusion(y_true, y_pred, labels):
    cm = pd.crosstab(pd.Series(y_true, name="actual"), pd.Series(y_pred, name="predicted"))
    return cm.reindex(index=labels, columns=sorted(set(y_pred) | {"crash", "no_crash"}), fill_value=0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data_dir")
    ap.add_argument("--impact-g", type=float, default=4.0)
    ap.add_argument("--min-speed", type=float, default=20.0)
    ap.add_argument("--drop", type=float, default=0.60)
    ap.add_argument("--tilt", type=float, default=60.0)
    ap.add_argument("--tilt-hold-ms", type=float, default=2000)
    ap.add_argument("--no-tree", action="store_true", help="skip the decision tree comparison")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.data_dir, "*.csv")))
    if not files:
        sys.exit(f"no CSV files in {args.data_dir}")

    rows = []
    for path in files:
        df = pd.read_csv(path)
        if "label" not in df.columns:
            label = os.path.basename(path).split("_")[0]
        else:
            label = str(df["label"].iloc[0])
        f = extract_features(df)
        f["label"] = label
        f["file"] = os.path.basename(path)
        rows.append(f)
    feats = pd.DataFrame(rows)
    labels = sorted(feats["label"].unique())
    print(f"{len(feats)} traces, classes: {dict(feats['label'].value_counts())}\n")

    print("Mean features per class:")
    print(feats.groupby("label")[FEATURES].mean().round(2).to_string(), "\n")

    # ------------------------------------------------------------------ rules
    feats["rules"] = feats.apply(lambda r: "crash" if rules_predict(r, args.impact_g, args.min_speed, args.drop, args.tilt, args.tilt_hold_ms) else "no_crash", axis=1)
    y_true_bin = np.where(feats["label"] == CRASH, "crash", "no_crash")
    cm = confusion(feats["label"], feats["rules"], labels)
    print(f"RULES (impact>={args.impact_g}g, speed>={args.min_speed}, drop>={args.drop:.0%}, tilt>={args.tilt}° for {args.tilt_hold_ms:.0f}ms)")
    print(cm.to_string())
    report(y_true_bin, feats["rules"].to_numpy(), "rules")

    # ------------------------------------------------------------------ tree
    if not args.no_tree:
        try:
            from sklearn.model_selection import cross_val_predict, StratifiedKFold
            from sklearn.tree import DecisionTreeClassifier, export_text
        except ImportError:
            print("scikit-learn not installed; skipping tree (pip install -r tools/requirements.txt)")
            return
        X = feats[FEATURES].to_numpy()
        y = y_true_bin
        n_min = pd.Series(y).value_counts().min()
        k = int(min(5, n_min))
        if k < 2:
            print("not enough samples per class for cross-validation")
            return
        clf = DecisionTreeClassifier(max_depth=3, min_samples_leaf=2, random_state=0)
        pred = cross_val_predict(clf, X, y, cv=StratifiedKFold(k, shuffle=True, random_state=0))
        print(f"\nDECISION TREE (depth<=3, {k}-fold CV)")
        print(confusion(feats["label"], pred, labels).to_string())
        report(y, pred, "tree")
        clf.fit(X, y)
        print("\nLearned rules:")
        print(export_text(clf, feature_names=FEATURES, decimals=2))

    out = os.path.join(args.data_dir, "features.csv")
    feats.to_csv(out, index=False)
    print(f"features written to {out}")


def report(y_true, y_pred, name):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    crash = y_true == "crash"
    tp = int(((y_pred == "crash") & crash).sum())
    fn = int(((y_pred != "crash") & crash).sum())
    fp = int(((y_pred == "crash") & ~crash).sum())
    tn = int(((y_pred != "crash") & ~crash).sum())
    det = tp / (tp + fn) if (tp + fn) else float("nan")
    far = fp / (fp + tn) if (fp + tn) else float("nan")
    print(f"  {name}: detection rate = {det:.1%} ({tp}/{tp + fn}),  false alarm rate = {far:.1%} ({fp}/{fp + tn})\n")


if __name__ == "__main__":
    main()
