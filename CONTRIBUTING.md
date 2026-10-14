# Contributing

Thanks for helping make roads safer.

## Ground rules

- **Safety first.** Never propose or run tests on a moving vehicle with a person on it. Bench
  rigs and padded drops only.
- **No secrets in git.** Phone numbers go in `firmware/include/secrets.h` (ignored). Firebase
  configs are generated locally. CI will not stop you — please check.
- **Honest numbers.** Results in `docs/testing-plan.md` must come from real recordings in
  `data/raw/`; synthetic traces are for pipeline development only.

## Workflow

1. Fork / branch from `main`.
2. Firmware changes: run `pio test -e native` and `pio run -e esp32dev` in `firmware/`.
   If you change the detector, add or adjust a scenario in
   `firmware/test/test_native/test_crash_detector.cpp`.
3. Threshold or pin changes: update `config.h` **and** the tables in
   `docs/crash-detection.md` / `hardware/wiring.md`.
4. Open a PR using the template.

## Good first issues

- Enclosure design (STL/STEP) in `hardware/enclosure/`
- Four-wheeler profile validation
- Multilingual SMS templates
- Flutter app: local notification channel setup, phone-number auth
- Dashboard: date-range filter, CSV export
