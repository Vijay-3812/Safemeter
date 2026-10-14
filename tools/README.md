# Tools

```bash
pip install -r tools/requirements.txt
```

| Script | Purpose |
|--------|---------|
| `data_logger/log_serial.py` | Record labelled CSV traces from the unit's serial port (`--label pothole --trial 3`) |
| `analysis/evaluate.py` | Extract per-event features, score the firmware thresholds **and** a 5-fold-CV decision tree, print confusion matrices and false-alarm / detection rates |
| `analysis/simulate_events.py` | Generate *synthetic* traces for developing the pipeline before real data exists (never report these as results) |

Typical flow:

```bash
# 1. record (repeat per trial)
python tools/data_logger/log_serial.py --port /dev/ttyUSB0 --label crash --trial 4 --seconds 20

# 2. evaluate
python tools/analysis/evaluate.py data/raw
python tools/analysis/evaluate.py data/raw --impact-g 5 --drop 0.5    # try other thresholds

# 3. (optional) smoke-test the pipeline without hardware
python tools/analysis/simulate_events.py --out data/synthetic --per-class 20
python tools/analysis/evaluate.py data/synthetic
```

`evaluate.py` writes `features.csv` next to the traces so you can plot them in any tool.
