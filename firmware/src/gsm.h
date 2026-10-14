/**
 * Gsm — SIM800L SMS sender with a non-blocking queue and store-and-forward.
 *
 * Sending an SMS over AT commands takes several seconds. Instead of blocking
 * the main loop (which would freeze the display, GPS parsing and sensor
 * sampling) this class walks through a small state machine in update().
 *
 * Messages that fail (no network registration, module not responding) stay in
 * the queue and are retried, so an alert raised in a zero-signal area is sent
 * as soon as coverage returns.
 *
 * POWER: the SIM800L needs 3.4–4.4 V and 2 A bursts. Use a dedicated buck
 * converter + ≥1000 µF capacitor. Do NOT power it from the ESP32 3.3 V pin.
 */
#pragma once

#include <Arduino.h>

class Gsm {
public:
    static constexpr uint8_t  QUEUE_LEN   = 6;
    static constexpr uint16_t MAX_SMS_LEN = 160;

    void begin(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud = 9600);
    void update();

    /** Queue an SMS. Returns false if the queue is full. Text is truncated to 160 chars. */
    bool sendSms(const char* number, const String& text);

    bool    ready()         const { return ready_; }      // module answered AT
    bool    registered()    const { return registered_; } // on the network
    int     signalCsq()     const { return csq_; }        // 0-31, 99 = unknown
    uint8_t pending()       const { return queueCount_; }
    uint32_t sentCount()    const { return sent_; }
    uint32_t failedCount()  const { return failed_; }

private:
    enum class Phase : uint8_t { BOOT, INIT_AT, INIT_ECHO_OFF, INIT_TEXT_MODE, IDLE,
                                 CHECK_REG, SEND_CMGS, WAIT_RESULT, BACKOFF };

    struct Msg { char number[20]; char text[MAX_SMS_LEN + 1]; uint8_t attempts; };

    void   sendCmd(const char* cmd);
    bool   readLine(String& out);
    void   enter(Phase p);
    void   popFront();
    void   failCurrent(const char* reason);

    HardwareSerial* serial_ = nullptr;
    Phase    phase_ = Phase::BOOT;
    uint32_t phaseStartMs_ = 0;
    uint32_t lastStatusPollMs_ = 0;
    String   rxBuf_;

    Msg      queue_[QUEUE_LEN];
    uint8_t  queueHead_ = 0, queueCount_ = 0;

    bool     ready_ = false, registered_ = false;
    int      csq_ = 99;
    uint32_t sent_ = 0, failed_ = 0;
};
