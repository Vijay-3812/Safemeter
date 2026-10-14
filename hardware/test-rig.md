# Bench test rig

A safe, repeatable way to generate potholes, braking and crashes without a moving vehicle.

## Build

- **Wheel and stand**: a bicycle wheel (or a motorcycle wheel) on a fixed stand. A front
  bicycle fork clamped in a vice or bolted to a plywood base works well.
- **Speed source**: hand-spin for quick checks; for repeatable speeds use a 12 V DC motor
  (e.g. a wiper motor or 775 motor with a rubber wheel) pressed against the tyre, driven
  from a PWM speed controller.
- **Magnet + hall sensor**: one magnet on a spoke, hall sensor on the fork, 2–3 mm gap.
- **Unit mounting**: the SafeMeter enclosure bolted rigidly to the fork/stand so impacts
  on the stand reach the IMU.
- **Padding**: a mattress or foam blocks under and around the rig for the "crash" test.

## Test procedures

| Test | Procedure | Expected firmware behaviour |
|------|-----------|-----------------------------|
| Normal riding | Spin the wheel to 30–60 km/h, keep it steady for 30 s | Stays in `NORMAL`, no events |
| Pothole | Wheel spinning; knock the stand sharply once with a rubber mallet | `IMPACT_TRIGGERED` → `REJECTED_SPEED` (wheel keeps turning) |
| Speed breaker | Two softer knocks 0.4 s apart, let the motor slow slightly | No countdown |
| Hard braking | Press a block against the tyre to stop it in 2–3 s | No `IMPACT_TRIGGERED` (no spike) |
| Crash | Knock the stand hard, immediately stop the wheel with a brake block, tip the whole rig onto the padding past ~60° | `CRASH_CONFIRMED` → countdown → `ALERT` (SMS arrives) |
| Cancel | Same as crash, press the button during the countdown | `CANCELLED`, no SMS |
| Store-and-forward | Remove the GSM antenna, run a crash, re-attach the antenna | SMS goes out when registration returns |

Record every trial with `tools/data_logger/log_serial.py` and label it. Minimum counts for the
validation table are in [`docs/testing-plan.md`](../docs/testing-plan.md).

## Safety

- Keep hands, hair and cables away from the spinning wheel. Use the motor's kill switch.
- Wear eye protection during impact tests.
- Padded drop tests only. **Never test on a moving vehicle with a person on it.**
- For optional low-speed on-bike validation (< 15 km/h in a closed area, helmets on, no
  staged falls), only the pothole / braking cases are run — never crashes.
