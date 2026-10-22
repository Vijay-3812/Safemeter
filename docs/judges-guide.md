# SafeMeter / Judge’s guide

**The one-line pitch:** A vehicle-powered speedometer that can send a signal for help when the rider cannot.

SEVA · Surakshit Bharat · Track A: Product or Technology

## The problem → the intervention

A crash victim may be unable to call, describe their location or depend on a bystander. SafeMeter is designed to identify a possible crash, allow cancellation, and send incident details to configured contacts using SMS. The connected extension coordinates nearby volunteers and records response times.

**The technical distinction:** use wheel-speed collapse and persistent tilt to add context to an impact spike. The aim is to reject common road jolts—not to claim every crash is detectable.

## Spend three minutes with the project

| Time | Inspect | What it demonstrates |
|---|---|---|
| 0:00–0:45 | [Dashboard demo instructions](../README.md#try-it-in-60-seconds) | Incident visibility, filtering and map-based exploration with **synthetic data** |
| 0:45–1:30 | [Detection core](../firmware/lib/CrashDetector/CrashDetector.cpp) and [tests](../firmware/test/test_native/test_crash_detector.cpp) | Readable state machine and deterministic scenario checks |
| 1:30–2:15 | [Architecture](architecture.md) | SMS-first path, optional cloud, responder assignment |
| 2:15–3:00 | [Evidence register](project-status.md) and [test plan](testing-plan.md) | Honest prototype boundaries and measurable next steps |

For a physical demonstration, follow the [bench demo runbook](demo-script.md). That flow requires assembled hardware, configured phones, network registration and a deployed connected stack for the volunteer segment; the repository alone does not establish that those steps have been completed.

## What makes the approach worth exploring?

- **Useful before an incident:** a live-speed interface instead of a device used only after a crash.
- **Vehicle-side autonomy:** the rider’s smartphone and mobile data are not required for SMS, subject to power and network availability.
- **Explainable decisions:** explicit gates and replay tests rather than an unsubstantiated “AI-powered” claim.
- **Human override:** a 15-second cancellation window before escalation.
- **Response is part of the design:** first-accept assignment, arrival tracking and a volunteer safety guide.

These are design choices, not claims that all other products lack these features.

## Questions we expect

**Does it work without internet?** The device-to-contact SMS path can. It still needs a working SIM and SMS network. Firebase, push notifications and the live dashboard need internet; the demo dashboard also uses external libraries and map tiles.

**Is 108 integrated?** No. The SMS includes “Call 108 if unreachable.” Approved emergency-service integration is future work. Test only with consenting team phones.

**How accurate is it?** No field detection rate or false-alarm rate is claimed. Eleven synthetic unit-test scenarios exercise the logic. The [validation plan](testing-plan.md) defines the bench measurements still needed.

**What does it cost?** The [BOM](../hardware/bom.md) estimates ₹1,900–2,900 for the prototype. Prices are indicative; the production estimate is not a supplier-backed quote.

**What can fail?** Low-speed or upright crashes may be missed; GPS can be stale; the ±16 g sensor can saturate; 2G can be unavailable; power loss can disable the unit. The cancel button cannot prove the rider is safe. No emergency response or medical outcome is guaranteed.

## What would make the next milestone credible?

1. Labelled bench recordings with repeatable mounting and calibrated wheel speed.
2. Detection and false-alarm tables with trial counts and failure cases.
3. Timestamped SMS delivery measurements and a cancelled-alert demonstration.
4. A deployed backend, physical app builds and consented volunteer drills.
5. Reviewed data access, retention and deletion before storing real incident locations.

[Back to the project →](../README.md)
