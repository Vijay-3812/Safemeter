#include "gsm.h"
#include "config.h"

static constexpr uint32_t T_BOOT_MS      = 3000;   // SIM800L needs a few seconds after power-up
static constexpr uint32_t T_CMD_MS       = 2000;
static constexpr uint32_t T_PROMPT_MS    = 5000;   // waiting for the '>' prompt
static constexpr uint32_t T_RESULT_MS    = 30000;  // +CMGS can take a while on weak signal
static constexpr uint32_t T_STATUS_MS    = 10000;  // how often to refresh CSQ / CREG when idle

void Gsm::begin(HardwareSerial& serial, int rxPin, int txPin, uint32_t baud) {
    serial_ = &serial;
    serial_->begin(baud, SERIAL_8N1, rxPin, txPin);
    rxBuf_.reserve(128);
    enter(Phase::BOOT);
}

void Gsm::enter(Phase p) {
    phase_ = p;
    phaseStartMs_ = millis();
}

void Gsm::sendCmd(const char* cmd) {
    serial_->print(cmd);
    serial_->print("\r\n");
}

// Collects characters into rxBuf_ and returns true when a full line is available.
bool Gsm::readLine(String& out) {
    while (serial_->available()) {
        char c = (char)serial_->read();
        if (c == '\r') continue;
        if (c == '\n') {
            rxBuf_.trim();
            if (rxBuf_.length() == 0) continue;
            out = rxBuf_;
            rxBuf_ = "";
            return true;
        }
        if (c == '>') {              // SMS body prompt has no newline
            out = ">";
            rxBuf_ = "";
            return true;
        }
        if (rxBuf_.length() < 120) rxBuf_ += c;
    }
    return false;
}

bool Gsm::sendSms(const char* number, const String& text) {
    if (queueCount_ >= QUEUE_LEN) return false;
    Msg& m = queue_[(queueHead_ + queueCount_) % QUEUE_LEN];
    strncpy(m.number, number, sizeof(m.number) - 1);
    m.number[sizeof(m.number) - 1] = '\0';
    strncpy(m.text, text.c_str(), MAX_SMS_LEN);
    m.text[MAX_SMS_LEN] = '\0';
    m.attempts = 0;
    queueCount_++;
    return true;
}

void Gsm::popFront() {
    if (queueCount_ == 0) return;
    queueHead_ = (queueHead_ + 1) % QUEUE_LEN;
    queueCount_--;
}

// Called exactly once per failed attempt: count it, drop the message if it has
// exhausted its retries, then back off before touching the modem again.
void Gsm::failCurrent(const char* reason) {
    if (queueCount_ > 0) {
        Msg& m = queue_[queueHead_];
        m.attempts++;
        Serial.printf("[GSM] %s (attempt %d/%d for %s)\n", reason, m.attempts, SMS_MAX_RETRIES, m.number);
        if (m.attempts >= SMS_MAX_RETRIES) {
            failed_++;
            Serial.printf("[GSM] giving up on %s\n", m.number);
            popFront();
        }
    }
    enter(Phase::BACKOFF);
}

void Gsm::update() {
    if (!serial_) return;
    const uint32_t now     = millis();
    const uint32_t elapsed = now - phaseStartMs_;
    String line;

    // Parse unsolicited / status lines in any phase
    bool gotLine = readLine(line);
    if (gotLine) {
        if (line.startsWith("+CSQ:")) {
            csq_ = line.substring(6).toInt();
        } else if (line.startsWith("+CREG:")) {
            int comma = line.indexOf(',');
            int stat  = line.substring(comma + 1).toInt();
            registered_ = (stat == 1 || stat == 5);   // home or roaming
        }
    }

    switch (phase_) {
    case Phase::BOOT:
        if (elapsed > T_BOOT_MS) { sendCmd("AT"); enter(Phase::INIT_AT); }
        break;

    case Phase::INIT_AT:
        if (gotLine && line == "OK") { ready_ = true; sendCmd("ATE0"); enter(Phase::INIT_ECHO_OFF); }
        else if (elapsed > T_CMD_MS) { sendCmd("AT"); enter(Phase::INIT_AT); }   // keep knocking
        break;

    case Phase::INIT_ECHO_OFF:
        if ((gotLine && line == "OK") || elapsed > T_CMD_MS) { sendCmd("AT+CMGF=1"); enter(Phase::INIT_TEXT_MODE); }
        break;

    case Phase::INIT_TEXT_MODE:
        if ((gotLine && line == "OK") || elapsed > T_CMD_MS) {
            sendCmd("AT+CREG?");
            lastStatusPollMs_ = now;
            enter(Phase::IDLE);
        }
        break;

    case Phase::IDLE:
        if (queueCount_ > 0) {
            sendCmd("AT+CREG?");
            enter(Phase::CHECK_REG);
        } else if (now - lastStatusPollMs_ > T_STATUS_MS) {
            sendCmd("AT+CSQ");
            lastStatusPollMs_ = now;
        }
        break;

    case Phase::CHECK_REG:
        if (gotLine && line == "OK") {
            if (registered_) {
                char cmd[40];
                snprintf(cmd, sizeof(cmd), "AT+CMGS=\"%s\"", queue_[queueHead_].number);
                sendCmd(cmd);
                enter(Phase::SEND_CMGS);
            } else {
                // Not on the network: do NOT count as an attempt — keep the message
                // and retry when coverage returns (store-and-forward).
                enter(Phase::BACKOFF);
            }
        } else if (elapsed > T_CMD_MS) {
            failCurrent("no response to AT+CREG?");
        }
        break;

    case Phase::SEND_CMGS:
        if (gotLine && line == ">") {
            serial_->print(queue_[queueHead_].text);
            serial_->write(0x1A);          // Ctrl+Z terminates the message
            enter(Phase::WAIT_RESULT);
        } else if ((gotLine && line.startsWith("ERROR")) || elapsed > T_PROMPT_MS) {
            serial_->write(0x1B);          // ESC aborts a half-open CMGS
            failCurrent("no '>' prompt");
        }
        break;

    case Phase::WAIT_RESULT:
        if (gotLine && line.startsWith("+CMGS:")) {
            sent_++;
            Serial.printf("[GSM] SMS sent to %s\n", queue_[queueHead_].number);
            popFront();
            enter(Phase::IDLE);
        } else if ((gotLine && line.startsWith("ERROR")) || (gotLine && line.startsWith("+CMS ERROR")) || elapsed > T_RESULT_MS) {
            failCurrent("send error / timeout");
        }
        break;

    case Phase::BACKOFF:
        if (elapsed > SMS_RETRY_INTERVAL_MS) enter(Phase::IDLE);
        break;
    }
}
