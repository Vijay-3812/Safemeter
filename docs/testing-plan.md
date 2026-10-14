# Testing and validation plan

Every trial is recorded with `tools/data_logger/log_serial.py`, labelled, and kept in `data/raw/`.
Results are produced with `tools/analysis/evaluate.py` and pasted into the tables below.

## 1. Detection accuracy (bench rig)

| Test category | Min. trials | Metric | Result |
|---------------|-------------|--------|--------|
| Normal riding (steady 30–60 km/h, 30 s each) | 10 | False alarm rate | _TBD_ |
| Pothole (single sharp knock, wheel spinning) | 20+ | False alarm rate | _TBD_ |
| Speed breaker (two softer knocks) | 10+ | False alarm rate | _TBD_ |
| Hard braking (stop in 2–3 s, no knock) | 15+ | False alarm rate | _TBD_ |
| Simulated crash (knock + stop + tip > 60°) | 15+ | Detection rate | _TBD_ |
| Simulated crash | 15+ | Detection time (impact → countdown start) | _TBD_ s |
| Crash, bike stays upright | 5+ | Expected: rejected (document) | _TBD_ |

**Decision tree vs. thresholds** (from `evaluate.py`):

| Classifier | Detection rate | False alarm rate |
|------------|----------------|------------------|
| Hand-set thresholds | _TBD_ | _TBD_ |
| Decision tree (depth 3, 5-fold CV) | _TBD_ | _TBD_ |

## 2. Alert delivery

| Test | Min. trials | Metric | Result |
|------|-------------|--------|--------|
| SMS to 2 contacts (good signal) | 10+ | Countdown end → SMS received | _TBD_ s |
| SMS with antenna removed, re-attached after 60 s | 3+ | Store-and-forward works | _TBD_ |
| Backend ingest → app push | 10+ | Countdown end → notification | _TBD_ s |
| GPS fix age at alert | all | Age of last fix (ms) | _TBD_ |

## 3. Cancel window

| Test | Trials | Result |
|------|--------|--------|
| Press cancel at 2 s, 8 s, 14 s | 3 each | No SMS sent, `cancelled` logged |
| No press | 5 | SMS sent at 15 s ± 0.5 s |

## 4. Volunteer pilot

10–15 volunteers, ≥ 5 drills over one week.

| Drill | Volunteers notified | First accept (s) | Arrival (min) | Notes |
|-------|---------------------|------------------|---------------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## 5. Power / robustness

| Test | Result |
|------|--------|
| 2 h continuous run on 12 V bench supply, no resets | _TBD_ |
| SIM800L transmit while GPS + OLED active — no brown-out | _TBD_ |
| Cold boot to first GPS fix (outdoors) | _TBD_ s |
| Vibration (rig motor at max) for 10 min — no false triggers | _TBD_ |

## Honest reporting

Bench impacts are far weaker than real crashes; the thresholds validated here are prototype
values. State clearly in the submission what was measured, what was simulated, and that
production units need a high-g sensor with field calibration.
