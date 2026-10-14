# Roadmap

## Prototype (4 weeks)

| Week | Deliverables | Status |
|------|--------------|--------|
| 1 | Hardware assembled on rig; speed + IMU + GPS reading; raw data logging | ☐ |
| 2 | Detection state machine tuned; 50+ labelled trials; accuracy table | ☐ |
| 3 | SMS alert; backend deployed; volunteer app on 2 phones; dashboard live | ☐ |
| 4 | Enclosure; cost sheet; 10–15 volunteer pilot with 5 drills; demo video | ☐ |

## After the prototype

- **Sensing:** ADXL375 high-g accelerometer; field calibration on instrumented test rides.
- **Comms:** 4G Cat-1 module (SIM7600 / EC200U) with SMS fallback; store-and-forward queue in
  flash so alerts survive a power loss.
- **Detection:** collect real-road data with fleet partners; evaluate a small on-device classifier
  (decision tree / tiny MLP) against the thresholds; add a four-wheeler profile with airbag-style
  longitudinal decel criteria.
- **Response network:** phone-number verification for volunteers; 108 integration via the state
  emergency-response API where available; multilingual SMS.
- **Product:** custom PCB, automotive power protection, IP65 enclosure, handlebar + dash mounts;
  OEM speedometer-cluster integration study.
- **Data:** anonymised black-spot export for municipal corporations / traffic police; insurer and
  fleet dashboards.
