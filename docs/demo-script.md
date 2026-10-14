# Live demo script (≈ 2 minutes)

**Setup before judges arrive:** rig powered, GPS has a fix (take it outdoors first — the unit
remembers the last fix), SIM registered (`GSM ||||` on the OLED), dashboard open on a laptop in
live mode, volunteer app open on a second phone with availability ON, a third phone as the
"family" contact.

| Time | Action | What the audience sees | Say |
|------|--------|------------------------|-----|
| 0:00 | Spin the wheel | OLED shows live speed, GPS sats, GSM bars | "SafeMeter is a speedometer first — it's powered by the vehicle, so it's always on." |
| 0:20 | Knock the stand sharply (pothole) | Brief "Impact detected / checking speed" then back to speed. Serial log: `REJECTED_SPEED` | "An accelerometer-only device would have called for help just now. Ours noticed the wheel kept turning." |
| 0:40 | Hard-stop the wheel with the brake block | Nothing happens | "Hard braking has no spike — no trigger." |
| 0:55 | Knock + stop wheel + tip rig past 60° | Buzzer, OLED flashes "CRASH DETECTED 15…" | "Three checks passed: impact, speed collapse, bike on its side. The rider now has 15 seconds." |
| 1:05 | Press cancel | "Cancelled — no alert sent" | "A minor fall or a false alarm costs nothing." |
| 1:15 | Repeat crash, don't cancel | Countdown reaches 0 → "ALERT SENT" | "No phone, no app, no internet needed." |
| 1:35 | Hold up the family phone | SMS arrives with speed, time and a map link | "Family and emergency numbers get this in parallel." |
| 1:45 | Hold up the volunteer phone | Push notification → tap → Accept | "Nearest trained volunteers are paged; first to accept is assigned." |
| 1:55 | Point at the dashboard | New red marker, time-to-accept populates | "Every incident is logged — that's how cities find black spots." |

**Fallbacks**

- No GSM registration in the hall? Say so, show the SMS text on the serial monitor, and show a
  photo/video of a successful outdoor SMS.
- No GPS indoors? The unit sends the last known fix; mention cold-start time honestly.
- Serial console shortcuts: `T` triggers a simulated impact at 45 km/h, `C` cancels — useful if
  the rig misbehaves.

**Safety:** padding under the rig, hands clear of the wheel, no one on a moving vehicle.
