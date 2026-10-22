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

## Choose a focused contribution

| Area | Useful first contribution | Include with your PR |
|---|---|---|
| Documentation | Improve setup, diagrams or translations | Verified links and reproducible commands |
| Firmware | Add a detector edge-case replay | Native test output; hardware impact explained |
| Dashboard | Improve accessibility or filtering | Browser checks and clearly labelled synthetic data |
| Data | Improve trial reproducibility | Labels, configuration and anonymised summaries |
| Hardware | Enclosure or wiring clarification | Dimensions, pin compatibility and safety notes |

Discuss large changes in an issue before implementing them. Keep a pull request focused and explain what changed, why, how it was tested and what remains unverified.

## Local checks

From the repository root:

```bash
python3 tools/check_docs.py
node --check backend/functions/index.js
node --check dashboard/app.js
```

For firmware, use the PlatformIO commands above. For the Python analysis pipeline, follow [tools/README.md](tools/README.md). Run the dashboard locally and verify its demo label, status filter, map selection and narrow-screen layout for UI changes. Report checks you could not run rather than implying they passed.

## Documentation and assets

- Keep relative links portable; run the documentation check before submitting.
- Keep the [evidence register](docs/project-status.md) current when implementation status changes.
- Distinguish synthetic data, measured results, estimates and targets.
- Prefer small, repository-local diagrams with readable labels and accessible descriptions. The branding SVGs in `docs/assets/` are concept artwork, not product photos.
- Do not commit generated build directories, device credentials, personal phone numbers or identifiable location traces.

Participation follows the [code of conduct](CODE_OF_CONDUCT.md). Report security-sensitive issues using the [security policy](SECURITY.md).
