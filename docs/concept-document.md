# SafeMeter — Concept Document

**A Vehicle-Powered Smart Speedometer That Detects Crashes and Summons Help in the Golden Hour**

| | |
|---|---|
| **Team name** | *[Your team name]* |
| **Entry level** | Open – Undergraduate |
| **Theme** | Surakshit Bharat |
| **Sub-theme** | *[Select the road-safety / emergency-response sub-theme]* |
| **Track** | Track A: Product or Technology |
| **Prototype** | Working hardware unit, volunteer app, dashboard |

> Original PDF: [`SafeMeter_Concept_Document.pdf`](SafeMeter_Concept_Document.pdf)

## 1. Executive summary

SafeMeter is a low-cost smart speedometer for two-wheelers, autos, cabs and trucks. It replaces
or sits beside the existing speedometer, shows live speed, and continuously monitors for crashes.
When a crash is confirmed, it gives the rider 15 seconds to cancel, and if there is no
cancellation it automatically sends an SMS with live location, speed at impact and a map link to
family, registered nearby volunteers and emergency services. No internet connection, smartphone
or user action is needed.

The core innovation is **sensor fusion**: instead of relying on an accelerometer alone (which
confuses potholes with crashes), SafeMeter combines wheel speed, impact force and vehicle
orientation. This cuts false alarms sharply while still detecting real crashes. A community of
trained volunteers forms the response layer, so help does not depend only on ambulance
availability.

## 2. Problem statement

Road accidents are a major cause of death and serious injury in India, and a large share of
victims are two-wheeler riders. Medical literature widely recognises a *golden hour* after trauma
in which timely care greatly improves survival. Delays happen because:

- Nobody may be nearby to call for help, especially on highways, at night or in rural areas.
- Bystanders often hesitate to get involved, and the victim may be unconscious.
- The exact location is hard to communicate to emergency services.
- Existing solutions depend on a charged phone, an installed app or a helmet worn and charged
  correctly, so they fail in exactly the situations that matter.

**Statistics (MoRTH, *Road Accidents in India 2024*):** India recorded 4,87,707 road accidents,
1,77,175 deaths and 4,71,441 injuries in 2024. Two-wheeler occupants were the largest victim
group at **46.2 % of all fatalities**, pedestrians a further 20.6 %; over-speeding was cited in
70.3 % of deaths, and National Highways — only 2.1 % of the network — accounted for 36.6 % of
deaths. ([MoRTH 2024 via Hindustan Times](https://www.hindustantimes.com/india-news/road-accident-deaths-increased-2-5-in-2024-from-2023-morth-report-101781204793385.html),
[The Policy Edge](https://www.policyedge.in/p/morth-road-accidents-report-2024-highways-over-speeding-and-young-adults-remain-key-risks))
That is roughly 20 deaths every hour, two-thirds of them aged 18–45
([Business Standard, on the 2023 report](https://www.business-standard.com/india-news/india-road-accidents-deaths-injuries-report-road-highway-ministry-nitin-gadkari-125082801527_1.html)).

## 3. Proposed solution

SafeMeter is a vehicle-mounted unit that does four things: measure speed and motion, decide
whether a crash has happened, alert people who can help, and record the incident so authorities
can fix dangerous spots.

| Stage | What happens | Technology |
|-------|--------------|------------|
| 1. Sense | Wheel speed, impact force, tilt and GPS position are read continuously | Hall sensor, MPU6050 IMU, NEO-6M GPS |
| 2. Decide | A three-stage state machine confirms a crash and rejects potholes and hard braking | ESP32 firmware, sensor fusion |
| 3. Cancel window | Buzzer and display show a 15-second countdown so a minor fall or false alarm can be cancelled | OLED display, buzzer, button |
| 4. Alert | SMS with location link, speed at impact and time goes to contacts, volunteers and emergency services | SIM800L GSM module (works without internet) |
| 5. Respond | Nearby volunteers get an app notification; the first to accept becomes the responder | Volunteer app with Firebase |
| 6. Analyse | Incidents are logged on a dashboard with response times and black-spot heatmaps | Web dashboard |

## 4. System architecture

**On-vehicle unit:** ESP32 microcontroller (main processor) with an MPU6050 accelerometer and
gyroscope, a hall sensor and magnet on the wheel for true speed, a NEO-6M GPS module for location
and backup speed, a SIM800L GSM module for SMS, an OLED display for speed and alerts, a buzzer and
cancel button, and a buck converter powering everything from the vehicle battery.

**Cloud and apps:** The unit sends the alert to emergency contacts by SMS and, where connectivity
exists, to a Firebase backend. The backend finds registered volunteers within a set radius and
pushes a notification to the volunteer app. The first volunteer to accept is assigned, and others
are told the case is taken. All events are stored for the dashboard.

**Why SMS first:** A large part of the road network has patchy mobile data but still has basic
voice and SMS coverage. SMS keeps the life-critical alert working where internet-based apps would
fail.

See [`architecture.md`](architecture.md) for diagrams.

## 5. Crash detection design (accelerometer and sensor fusion)

### 5.1 Sensors and settings

- **MPU6050 (prototype):** low-cost accelerometer and gyroscope. Configured at ±16 g range,
  100–200 Hz sampling over I²C, with the built-in low-pass filter (about 40 Hz) to remove engine
  vibration.
- **Production upgrade:** a high-g sensor such as ADXL375 or H3LIS331DL (about ±200 g) to capture
  real crash magnitudes, which can exceed the prototype sensor range.
- **Mounting and calibration:** rigid mounting to the frame or speedometer housing. At power-up,
  the resting gravity vector is stored as the upright reference. Impact detection uses the total
  magnitude √(ax² + ay² + az²), so it does not depend on mounting orientation.

### 5.2 Distinguishing events

| Event | Acceleration pattern | Wheel speed | After the event |
|-------|----------------------|-------------|-----------------|
| Pothole | Short vertical spike, under about 100 ms | Continues | Normal riding |
| Speed breaker | Smaller, repeated spikes | Dips slightly, recovers | Normal riding |
| Hard braking | Sustained 0.5–0.8 g along travel direction, no spike | Falls gradually | Normal riding |
| Crash | Large spike with high vibration | Collapses within about 1 s | Tilted or stationary |

### 5.3 Three-stage detection logic

- **Stage 1 – Trigger:** total acceleration crosses an impact threshold (starting value about 4 g
  for bench testing, tuned from collected data).
- **Stage 2 – Speed confirmation:** speed was above about 20 km/h before impact and fell by more
  than about 60 % within 1 second. A pothole fails this test because speed continues.
- **Stage 3 – Orientation confirmation:** for two-wheelers, tilt beyond about 60 degrees for more
  than 2 seconds (vehicle on its side). For four-wheelers, no motion for several seconds.

Only when all three stages pass does the 15-second cancel countdown begin. Tilt is estimated with
a complementary filter (about 98 % gyro, 2 % accelerometer), which is lightweight and runs easily
on the ESP32.

Implementation: [`firmware/lib/CrashDetector`](../firmware/lib/CrashDetector/CrashDetector.cpp),
details in [`crash-detection.md`](crash-detection.md).

### 5.4 Optional machine-learning layer

Labelled test data (potholes, braking, simulated crashes) will be used to train a small decision
tree or lightweight classifier, compared against hand-set thresholds. Results will be reported
honestly, including cases where thresholds perform equally well.
Tooling: [`tools/analysis/evaluate.py`](../tools/analysis/evaluate.py).

## 6. Volunteer response network

SafeMeter treats response as seriously as detection. Local volunteers (students, shopkeepers,
riders' clubs, trained ward or panchayat members) register in the app with their location and
availability. On an alert, the nearest available volunteers are notified, the first to accept sees
the live map link and speed at impact, and the system records time-to-accept and time-to-arrival.

- **Training:** a short module covering safe scene approach, calling 108, and not moving
  suspected spinal-injury victims — [`volunteer-training.md`](volunteer-training.md).
- **Safety and trust:** volunteers are registered with basic verification, and the app provides
  guidance rather than medical instructions.
- **Fallback:** alerts always go to family and emergency numbers in parallel, so the system never
  depends on volunteers alone.

## 7. Prototype and demonstration plan

### 7.1 Hardware bill of materials (prototype)

| Component | Purpose |
|-----------|---------|
| ESP32 development board | Main controller with Wi-Fi/Bluetooth |
| MPU6050 IMU | Impact force and tilt |
| Hall sensor and magnet | Accurate wheel speed |
| NEO-6M GPS | Location and backup speed |
| SIM800L GSM module | SMS alerts without internet |
| OLED/TFT display, buzzer, button | Speed display, countdown, cancel |
| Buck converter, enclosure | Vehicle power and housing |

Estimated prototype cost is about ₹ 2,000–2,500 (to be confirmed with current prices). At 1,000
units, bulk sourcing and a custom board are expected to bring this towards ₹ 1,500.
*[Replace with your actual costed figure.]* Full list: [`hardware/bom.md`](../hardware/bom.md).

### 7.2 Live demo flow (about 2 minutes)

1. Mount the unit on a bike or a bench rig with a spinning wheel; the display shows live speed.
2. Simulate a pothole: no alarm is raised.
3. Simulate a crash: the countdown starts. Show cancelling once, then let it run out.
4. The SMS arrives on a phone and the volunteer app pings with a map.
5. The dashboard logs the incident with time, location and speed.

**Safety note:** all crash simulations use bench rigs or padded, controlled drop tests. No real
vehicle crash or rider risk is involved. Script: [`demo-script.md`](demo-script.md).

## 8. Testing and validation plan

Raw sensor data will be logged and labelled for each trial, then summarised in an accuracy table.

| Test category | Minimum trials | Metric reported |
|---------------|----------------|-----------------|
| Pothole / speed breaker passes | 20+ | False alarm rate |
| Hard braking events | 15+ | False alarm rate |
| Simulated crashes (bench / padded drop) | 15+ | Detection rate, detection time |
| Alert delivery (SMS and app) | 10+ | End-to-end delay |
| Volunteer pilot (10–15 volunteers, test alerts) | 5+ drills | Time to accept and reach |

*[After testing, insert your actual results here, e.g. detection rate, false alarm rate and
average alert delay.]* Template: [`testing-plan.md`](testing-plan.md).

## 9. Impact and scalability

- **Faster help:** automatic alerts remove the dependence on bystanders and speak the victim's
  exact location within seconds.
- **Inclusive:** works on any vehicle, in any language, with no smartphone or data plan.
- **Data for prevention:** aggregated, anonymised incident data shows accident black spots so
  municipalities and traffic police can act.
- **Scalable:** starts as a retrofit unit for cabs, delivery fleets and two-wheelers, with a path
  to OEM integration. Fleet operators and insurers are natural early customers because faster
  response and driver safety reduce their costs.
- **Policy fit:** aligns with national road-safety priorities and emergency-response initiatives.

**Possible business model**

- Unit sale or fleet subscription (device plus alert service).
- Fleet and insurer partnerships for bulk deployment.
- Anonymised black-spot analytics offered to government bodies.

## 10. Innovation and differentiation

| Existing approach | Limitation | SafeMeter advantage |
|-------------------|------------|---------------------|
| Phone crash-detection apps | Need charged phone, app running, data | Vehicle-powered, always on, SMS-based |
| Smart helmets | Depend on charging and wearing | No rider action needed |
| Accelerometer-only detectors | Confuse potholes with crashes | Speed + impact + tilt fusion |
| Emergency calls (108) | Need someone to call | Automatic alert plus volunteer layer |

## 11. Limitations and risks (and how we address them)

- **Cannot tell if the rider was thrown or injured:** addressed by the cancel window, and by
  sending speed at impact so responders can judge severity.
- **Bench tests produce lower forces than real crashes:** thresholds are prototype values;
  production would use a high-g sensor with field calibration.
- **Coverage gaps:** in zero-signal areas the unit stores the alert and sends when signal returns.
- **Installation and recurring SMS cost:** positioned as a retrofit unit; alert-only SMS plans are
  low cost per vehicle.
- **Privacy:** location is shared only when an alert fires; dashboard data is anonymised.

## 12. Implementation timeline

| Week | Activities |
|------|------------|
| 1 | Assemble hardware, wire sensors, log raw data |
| 2 | Build detection logic, run 50+ labelled tests |
| 3 | Build volunteer app, SMS flow and dashboard |
| 4 | Enclosure, cost sheet, volunteer pilot, demo video |

## 13. Conclusion

SafeMeter closes the most dangerous gap in road safety: the minutes between a crash and the
arrival of help. By fusing wheel speed, impact and orientation, it detects crashes reliably
without a phone or charging habit, and by pairing detection with a volunteer network and an
incident dashboard, it turns a single alert into a faster, more accountable emergency response
system.

---

**Team members:** *[Name 1, Name 2, Name 3, Name 4]* | **Institution:** *[College name]* |
**Contact:** *[Email]*
