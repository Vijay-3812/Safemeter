# Bill of materials — prototype

Indicative Indian retail prices (Oct 2026, single-unit, ex-shipping). **Verify current prices
before quoting** — modules swing ±30 % between sellers.

| # | Component | Purpose | Qty | Approx. ₹ |
|---|-----------|---------|-----|-----------|
| 1 | ESP32 DevKit V1 (30-pin) | Main controller, Wi-Fi/BT | 1 | 350 – 450 |
| 2 | MPU6050 module (GY-521) | Impact force + tilt (±16 g, ±2000 °/s) | 1 | 100 – 150 |
| 3 | A3144 / 49E hall sensor + neodymium magnet | True wheel speed | 1 + 2 | 40 – 80 |
| 4 | NEO-6M GPS module with ceramic antenna | Location + backup speed | 1 | 350 – 500 |
| 5 | SIM800L GSM module (+ spring antenna) | SMS without internet | 1 | 250 – 400 |
| 6 | 0.96" SSD1306 OLED 128×64 I²C | Speed, countdown, status | 1 | 150 – 250 |
| 7 | Active buzzer 5 V | Countdown alarm | 1 | 15 – 30 |
| 8 | Momentary push button (large, weather-resistant) | Cancel | 1 | 20 – 60 |
| 9 | LM2596 buck converter (12 V → 5 V) | ESP32 + sensors rail | 1 | 60 – 100 |
| 10 | LM2596 / MP1584 buck converter (12 V → 4.0 V) | Dedicated SIM800L rail | 1 | 60 – 100 |
| 11 | 1000 µF 16 V electrolytic capacitor | SIM800L burst current | 1 | 10 – 20 |
| 12 | 10 kΩ + 20 kΩ resistors (divider), 10 kΩ pull-up | Level shift TX→SIM800L RX, hall pull-up | – | 10 |
| 13 | Prepaid 2G-capable SIM (SMS plan) | Alerts | 1 | 100 – 200 / month |
| 14 | ABS enclosure ~100×60×35 mm, IP54 | Housing | 1 | 100 – 200 |
| 15 | Perfboard, headers, JST connectors, wire, heat-shrink | Assembly | – | 150 – 250 |
| 16 | Fuse holder + 2 A blade fuse, inline switch | Vehicle power safety | 1 | 50 – 80 |
|   | **Total (prototype)** | | | **≈ ₹ 1,900 – 2,900** |

Bench-demo extras: 12 V 2 A adaptor or 3S Li-ion pack (₹ 300 – 600), bicycle wheel + stand.

## Projected unit cost at 1,000 units

| Change | Effect |
|--------|--------|
| Custom PCB with ESP32-WROOM module instead of DevKit | –₹ 150 |
| Bare MPU6050 / ADXL375 IC on PCB | –₹ 50 (ADXL375 adds +₹ 300 but is the right sensor) |
| Quectel M66 / SIM7600 (4G) instead of SIM800L | +₹ 400 – 900 (needed: 2G sunset) |
| Bulk GPS (u-blox M10 / Quectel L76) | –₹ 100 |
| Injection-moulded housing | –₹ 80 |
| **Estimated** | **≈ ₹ 1,500 (2G) – ₹ 2,300 (4G + high-g)** |

[Replace with your actual costed figures once you have supplier quotes.]

## Production upgrades (not in the prototype)

| Prototype part | Production part | Why |
|----------------|-----------------|-----|
| MPU6050 (±16 g) | ADXL375 (±200 g) or H3LIS331DL (±400 g) | Real crashes exceed 16 g; MPU6050 saturates |
| SIM800L (2G) | 4G Cat-1 / Cat-M module (SIM7600, EC200U) | 2G networks are being retired |
| NEO-6M | u-blox M10 / L76 with assisted GPS | Faster cold start, lower power |
| Buck converters | Automotive-grade regulator with load-dump protection | Vehicle electrical transients |
