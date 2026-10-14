/**
 * Display — 128x64 SSD1306 OLED screens for SafeMeter.
 *
 *  NORMAL     : big speed readout + GPS / GSM status icons
 *  COUNTDOWN  : "CRASH DETECTED" + seconds remaining + "PRESS TO CANCEL"
 *  ALERT_SENT : confirmation that the SMS went out
 *  CANCELLED  : short confirmation screen
 */
#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

struct StatusInfo {
    bool    gpsFix = false;
    uint8_t satellites = 0;
    bool    gsmReady = false;
    bool    gsmRegistered = false;
    int     csq = 99;
    bool    imuOk = false;
    bool    hallSignal = false;
    float   tiltDeg = 0;
    float   accelG = 1.0f;
};

class Display {
public:
    bool begin(TwoWire& wire, uint8_t addr = 0x3C);

    void showBoot(const char* line1, const char* line2 = "");
    void showSpeed(float kmh, const StatusInfo& st);
    void showImpactCheck(const char* stage);
    void showCountdown(uint32_t secondsLeft);
    void showAlertSent(uint8_t pending);
    void showCancelled();

    bool ok() const { return ok_; }

private:
    void header(const StatusInfo& st);
    Adafruit_SSD1306 oled_{128, 64, &Wire, -1};
    bool ok_ = false;
};
