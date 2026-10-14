#include "display.h"
#include "config.h"

bool Display::begin(TwoWire& wire, uint8_t addr) {
    (void)wire;   // the member object is bound to the global Wire bus (see display.h)
    ok_ = oled_.begin(SSD1306_SWITCHCAPVCC, addr);
    if (ok_) {
        oled_.clearDisplay();
        oled_.setTextColor(SSD1306_WHITE);
        oled_.display();
    }
    return ok_;
}

void Display::showBoot(const char* line1, const char* line2) {
    if (!ok_) return;
    oled_.clearDisplay();
    oled_.setTextSize(2);
    oled_.setCursor(0, 0);
    oled_.println("SafeMeter");
    oled_.setTextSize(1);
    oled_.setCursor(0, 24);
    oled_.println(line1);
    oled_.setCursor(0, 36);
    oled_.println(line2);
    oled_.setCursor(0, 54);
    oled_.print("fw ");
    oled_.print(SM_FIRMWARE_VERSION);
    oled_.display();
}

void Display::header(const StatusInfo& st) {
    oled_.setTextSize(1);
    oled_.setCursor(0, 0);
    // GPS: "GPS 7" (sats) or "GPS --"
    oled_.print("GPS ");
    if (st.gpsFix) oled_.print(st.satellites); else oled_.print("--");
    // GSM signal bars
    oled_.setCursor(64, 0);
    oled_.print("GSM ");
    if (!st.gsmReady)            oled_.print("off");
    else if (!st.gsmRegistered)  oled_.print("srch");
    else {
        int bars = st.csq == 99 ? 0 : constrain(st.csq / 6, 0, 4);
        for (int i = 0; i < 4; ++i) oled_.print(i < bars ? '|' : '.');
    }
    oled_.drawLine(0, 10, 127, 10, SSD1306_WHITE);
}

void Display::showSpeed(float kmh, const StatusInfo& st) {
    if (!ok_) return;
    oled_.clearDisplay();
    header(st);

    int v = (int)(kmh + 0.5f);
    if (v > 199) v = 199;
    oled_.setTextSize(4);
    // right-align 3 digits in a 72 px wide field
    char buf[12];
    snprintf(buf, sizeof(buf), "%3d", v);
    oled_.setCursor(8, 18);
    oled_.print(buf);
    oled_.setTextSize(1);
    oled_.setCursor(88, 40);
    oled_.print("km/h");

    // footer: tilt + g + sensor health
    oled_.setCursor(0, 56);
    char foot[32];
    snprintf(foot, sizeof(foot), "t%2.0f g%.1f %s%s", st.tiltDeg, st.accelG,
             st.imuOk ? "" : "IMU! ", st.hallSignal ? "" : "HALL?");
    oled_.print(foot);
    oled_.display();
}

void Display::showImpactCheck(const char* stage) {
    if (!ok_) return;
    oled_.clearDisplay();
    oled_.setTextSize(1);
    oled_.setCursor(0, 0);
    oled_.println("Impact detected");
    oled_.setCursor(0, 16);
    oled_.println(stage);
    oled_.display();
}

void Display::showCountdown(uint32_t secondsLeft) {
    if (!ok_) return;
    oled_.clearDisplay();
    oled_.setTextSize(2);
    oled_.setCursor(10, 0);
    oled_.println("CRASH");
    oled_.setCursor(10, 16);
    oled_.println("DETECTED");
    oled_.setTextSize(3);
    oled_.setCursor(46, 34);
    if (secondsLeft < 10) oled_.print(' ');
    oled_.print(secondsLeft);
    oled_.setTextSize(1);
    oled_.setCursor(16, 57);
    oled_.print("PRESS TO CANCEL");
    // invert every other second so the screen visibly flashes
    oled_.invertDisplay(secondsLeft % 2 == 0);
    oled_.display();
}

void Display::showAlertSent(uint8_t pending) {
    if (!ok_) return;
    oled_.invertDisplay(false);
    oled_.clearDisplay();
    oled_.setTextSize(2);
    oled_.setCursor(0, 0);
    oled_.println("ALERT SENT");
    oled_.setTextSize(1);
    oled_.setCursor(0, 24);
    oled_.println("Help has been called.");
    oled_.setCursor(0, 36);
    if (pending > 0) {
        oled_.print("Sending... ");
        oled_.print(pending);
        oled_.println(" left");
    } else {
        oled_.println("All SMS delivered.");
    }
    oled_.setCursor(0, 54);
    oled_.println("Stay still if injured.");
    oled_.display();
}

void Display::showCancelled() {
    if (!ok_) return;
    oled_.invertDisplay(false);
    oled_.clearDisplay();
    oled_.setTextSize(2);
    oled_.setCursor(0, 8);
    oled_.println("Cancelled");
    oled_.setTextSize(1);
    oled_.setCursor(0, 36);
    oled_.println("No alert was sent.");
    oled_.setCursor(0, 48);
    oled_.println("Ride safe.");
    oled_.display();
}
