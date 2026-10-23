# Evidence & project status

> **Source available ≠ integrated hardware ≠ field-validated product.** This register describes repository evidence, not a certification. Last documentation review: 22 October 2026.

The original concept and prototype PDFs describe the intended experience and include “real and working” tables. Those statements are not independently verified by the source checkout. Use the distinctions below when presenting this repository.

## Evidence register

| Area | Inspectable evidence | Still required before making a stronger claim |
|---|---|---|
| Decision logic | [Portable C++ state machine](../firmware/lib/CrashDetector/), [11 replay scenarios](../firmware/test/test_native/test_crash_detector.cpp) | Successful native test run in the target environment; labelled bench trials for real sensors |
| Device integration | [ESP32 sources](../firmware/src/), [pin configuration](../firmware/include/config.h) | Board build, wiring review, physical demonstration and calibration records |
| Alert delivery | [SMS composition and dispatch](../firmware/src/alert.cpp), [GSM queue](../firmware/src/gsm.cpp) | Carrier registration, latency measurements, retries, power-loss tests and recipient confirmation |
| Responder coordination | [Cloud Functions](../backend/functions/index.js), [Flutter source](../volunteer-app/lib/) | Deployment, device builds, authorization tests, notification and concurrent-accept drills |
| Operations UI | [Static dashboard](../dashboard/) and synthetic demo path | Browser verification; authenticated live integration and access review |
| Evaluation workflow | [Generator and evaluator](../tools/analysis/) | Independent, labelled measured data; synthetic scores do not estimate field safety |
| Physical design | [BOM](../hardware/bom.md), [wiring](../hardware/wiring.md), [rig](../hardware/test-rig.md) | Assembly photos, supplier quotes, enclosure files and environmental testing |

CI checks are defined in [the workflow](../.github/workflows/ci.yml); consult the actual run rather than treating a badge or this document as proof of success. Backend CI currently checks syntax, not business logic or Firestore authorization. Flutter device builds are not currently covered by CI.

## Claims discipline

| Safe wording | Do not claim without evidence |
|---|---|
| “Designed to reject pothole-like synthetic scenarios” | “No false alarms” |
| “Queues SMS to preset contacts when the countdown expires” | “Guaranteed emergency delivery” |
| “Volunteer dispatch implementation provided” | “A deployed volunteer network is responding” |
| “No rider smartphone required for the SMS path” | “Works with no network” |
| “Indicative prototype BOM” | “Confirmed production price” |
| “Potential to reduce notification delay” | “Proven survival improvement” |

## Known deployment blockers

- **Detection:** prototype thresholds, mounting sensitivity, ±16 g saturation, missed low-speed/upright crashes and no measured field accuracy.
- **Reliability:** 2G availability, GPS lock/age, battery disconnection, and no demonstrated durable alert retention through power failure.
- **Security:** production provisioning, rate limits, authentication, authorization and Firestore rule tests require explicit review. See [security policy](../SECURITY.md).
- **Privacy:** precise incident coordinates are sensitive. A vehicle ID is not sufficient anonymisation; the current dashboard must not be presented as a privacy-preserving public analytics product.
- **Response:** volunteer screening, consent, coverage and drills are prerequisites. 108 integration is not implemented.
- **Certification:** automotive electrical protection, enclosure/environmental testing, compliance and clinical/safety evaluation are not established.

## Publish results responsibly

For every measurement, record the commit, hardware and firmware configuration, trial count, labels, timestamps, failure cases and whether the data is synthetic or measured. Publish anonymised summaries; keep contact numbers and precise personal routes out of Git. The [testing plan](testing-plan.md) and [data conventions](../data/README.md) are the starting points.

[Back to the project →](../README.md)

## Checkout verification / 22 October 2026

The documentation refresh was checked locally with:

- **Native detector suite:** 11 tests passed, zero failures. Compiled the existing test source and `CrashDetector.cpp` with `g++ -std=c++17 -Wall -DNATIVE_TEST`, linking Unity v2.6.1 built with GCC. This direct native run exercises the detector tests; it is **not** a PlatformIO ESP32 build or hardware validation.
- **JavaScript syntax:** `node --check` passed for `backend/functions/index.js` and the former flat dashboard script at that review point. The dashboard has since been replaced; current checks are in `dashboard/IMPLEMENTATION.md`. This is not a runtime integration test.
- **Documentation:** `python3 tools/check_docs.py` checks local Markdown file targets and SVG title/description metadata. It does not validate remote URLs, heading anchors or browser rendering.

ESP32 cross-compilation, Flutter builds, Firebase deployment and physical SMS delivery were not verified as part of this documentation refresh.

## Dashboard redesign / 23 October 2026

The operations UI is now a Vite/React/TypeScript simulation with a typed API-source stub rather than an automatic Firebase connection. See the [dashboard implementation review](../dashboard/IMPLEMENTATION.md) for current quality measurements and limitations. Browser checks and screenshots do not establish hardware, SMS or live emergency-response integration.
