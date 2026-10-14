# Hardware

| File | Contents |
|------|----------|
| [`bom.md`](bom.md) | Bill of materials with indicative prices and production upgrade path |
| [`wiring.md`](wiring.md) | Pin map, power architecture, SIM800L power/level-shift notes |
| [`test-rig.md`](test-rig.md) | Bench rig build and the test procedures for each event type |
| `enclosure/` | (to do) enclosure drawings / STL files |

Build order (so something always works): display + speed → IMU + logging → GPS → detection +
countdown → GSM + SMS → backend/app/dashboard → enclosure. Details in
[`docs/prototype-description.md`](../docs/prototype-description.md#12-build-order).
