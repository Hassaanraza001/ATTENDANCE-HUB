// =========================================================================================
// == ARDUINO CODE: BIOMETRIC & SMS - FULL VERSION ==
// =========================================================================================
// This code manages:
// 1. AS608 Fingerprint Sensor for enrollment and attendance.
// 2. SIM800L GSM Module for sending SMS notifications.
// 3. LCD 16x2 Display for status feedback.
// 4. Buzzer for audio feedback.
// 5. Serial communication with the Electron desktop app.

// --- LIBRARIES ---
#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>
#include <LiquidCrystal.h> 

// --- PIN CONFIGURATION ---
// Fingerprint Sensor (using SoftwareSerial)
#define FINGERPRINT_RX 4 // Connects to Sensor's TX (Green)
#define FINGERPRINT_TX 5 // Connects to Sensor's RX (White)

// GSM Module (using another SoftwareSerial instance)
#define GSM_RX 2 // Connects to GSM's TX
#define GSM_TX 3 // Connects to GSM's RX

// Buzzer
#define BUZZER_PIN 6

// LCD Display
LiquidCrystal lcd(7, 8, 9, 10, 11, 12); // RS, EN, D4, D5, D6, D7

// --- SERIAL SETUP ---
SoftwareSerial mySerial(FINGERPRINT_RX, FINGERPRINT_TX);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
SoftwareSerial gsm(GSM_RX, GSM_TX); 

// --- GLOBAL VARIABLES ---
bool isAttendanceMode = false;

// --- CUSTOM LCD CHARACTERS ---
byte smiley[8] = { B00000, B10001, B00000, B00000, B10001, B01110, B00000, B00000 };
byte sadFace[8] = { B00000, B10001, B00000, B00000, B01110, B10001, B00000, B00000 };
byte antenna[8] = { B00100, B01010, B01010, B01110, B00100, B00100, B00100, B00000 };
byte fingerIcon[8] = { B00100, B01110, B11111, B11111, B11111, B01110, B00100, B00000 };

// =========================================================================================
// == SETUP: Runs once on startup                                                      ==
// =========================================================================================
void setup() {
  Serial.begin(9600);       
  gsm.begin(9600);          
  finger.begin(57600);      
  pinMode(BUZZER_PIN, OUTPUT); // Set buzzer pin as output

  lcd.begin(16, 2); 
  lcd.createChar(0, smiley);
  lcd.createChar(1, sadFace);
  lcd.createChar(2, antenna);
  lcd.createChar(3, fingerIcon);
  
  lcd.clear();
  lcd.print("Attendance HUB");
  lcd.setCursor(0, 1);
  lcd.print("System Booting...");
  delay(1500);

  if (finger.verifyPassword()) {
    lcd.clear();
    lcd.print("Finger Sensor OK");
    Serial.println("INFO:Fingerprint_sensor_found");
  } else {
    lcd.clear();
    lcd.print("Sensor Not Found");
    Serial.println("ERR:Did_not_find_fingerprint_sensor");
    while (1) { delay(1); } // Halt if sensor not found
  }
  delay(1500);
  
  initializeGSM();

  lcd.clear();
  lcd.print("System Ready ");
  lcd.write(byte(0));
  lcd.setCursor(0, 1);
  lcd.print("Waiting for App...");
  Serial.println("ARDUINO_READY");
}

// =========================================================================================
// == MAIN LOOP: Runs continuously                                                      ==
// =========================================================================================
void loop() {
  handleSerialCommands();

  if (isAttendanceMode) {
    scanFingerForAttendance();
  }
}

// =========================================================================================
// == SERIAL COMMAND HANDLING                                                           ==
// =========================================================================================
void handleSerialCommands() {
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');
        command.trim(); 
        if (command.length() > 0) {
            processCommand(command);
        }
    }
}


void processCommand(String command) {
    String cmd_type = getValue(command, ',', 0);
    cmd_type.trim();

    if (cmd_type == "ENROLL_FINGER") {
        int id = getValue(command, ',', 1).toInt();
        getFingerprintEnroll(id);
    } else if (cmd_type == "START_ATTENDANCE") {
        isAttendanceMode = true;
        lcd.clear();
        lcd.print("Scan Finger ");
        lcd.write(byte(3));
        lcd.setCursor(0, 1);
        lcd.print("To Mark Present");
        Serial.println("INFO:Biometric_attendance_started");
    } else if (cmd_type == "END_ATTENDANCE") {
        isAttendanceMode = false;
        lcd.clear();
        lcd.print("System Ready ");
        lcd.write(byte(0));
        Serial.println("INFO:Biometric_attendance_ended");
    } else if (cmd_type == "P" || cmd_type == "A") {
        processSmsCommand(command);
    }
    else {
      Serial.println("ERR:Invalid_command_format._Skipping.");
    }
}


// =========================================================================================
// == FINGERPRINT FUNCTIONS                                                             ==
// =========================================================================================

void scanFingerForAttendance() {
  int fingerId = getFingerprintID();
  if (fingerId != -1) {
    digitalWrite(BUZZER_PIN, HIGH); // Turn buzzer ON
    delay(150); // Beep for 150 milliseconds
    digitalWrite(BUZZER_PIN, LOW);  // Turn buzzer OFF

    lcd.clear();
    lcd.print("Finger Found!");
    lcd.setCursor(0, 1);
    lcd.print("ID: ");
    lcd.print(fingerId);
    Serial.print("FINGER_SCANNED,");
    Serial.println(fingerId);
    delay(1500); // Show ID on LCD
    lcd.clear();
    lcd.print("Scan Finger ");
    lcd.write(byte(3));
    lcd.setCursor(0, 1);
    lcd.print("To Mark Present");
  }
}

int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerSearch();
  if (p != FINGERPRINT_OK) return -1;
  
  return finger.fingerID;
}

void getFingerprintEnroll(int id) {
  isAttendanceMode = false; // Pause attendance during enrollment
  Serial.print("ENROLL_START,");
  Serial.println(id);

  lcd.clear();
  lcd.print("Enrolling ID #");
  lcd.print(id);
  lcd.setCursor(0, 1);
  lcd.print("Place finger...");
  Serial.println("ENROLL_INFO,Place_finger_on_sensor");
  int p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }
  
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println("ENROLL_FAIL,Image_conversion_failed");
    lcd.clear(); lcd.print("Enroll Failed!"); delay(2000);
    return;
  }

  lcd.clear();
  lcd.print("Remove Finger");
  Serial.println("ENROLL_INFO,Remove_finger");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }

  lcd.clear();
  lcd.print("Place Same Finger");
  lcd.setCursor(0, 1);
  lcd.print("Again...");
  Serial.println("ENROLL_INFO,Place_same_finger_again");
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println("ENROLL_FAIL,Image_conversion_failed");
    lcd.clear(); lcd.print("Enroll Failed!"); delay(2000);
    return;
  }

  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
     Serial.println("ENROLL_FAIL,Could_not_create_model");
     lcd.clear(); lcd.print("Fingers_not_match"); delay(2000);
     return;
  }

  p = finger.storeModel(id);
  if (p != FINGERPRINT_OK) {
    Serial.println("ENROLL_FAIL,Could_not_store_model");
    lcd.clear(); lcd.print("Storage_Error"); delay(2000);
    return;
  }

  Serial.print("ENROLL_SUCCESS,");
  Serial.println(id);
  digitalWrite(BUZZER_PIN, HIGH); delay(50); digitalWrite(BUZZER_PIN, LOW); delay(50);
  digitalWrite(BUZZER_PIN, HIGH); delay(50); digitalWrite(BUZZER_PIN, LOW);

  lcd.clear();
  lcd.print("Enroll Success!");
  lcd.setCursor(0, 1);
  lcd.print("ID: "); lcd.print(id);
  delay(2000);
  
  lcd.clear();
  lcd.print("System Ready ");
  lcd.write(byte(0));
}


// =========================================================================================
// == SMS FUNCTIONS                                                                     ==
// =========================================================================================
void processSmsCommand(String command) {
    String status_tag = getValue(command, ',', 0);
    String student_name = getValue(command, ',', 1);
    String phone_number = getValue(command, ',', 2);
    
    if (phone_number.length() > 0) {
        String message = "";
        String schoolName = "- SOE Admin";
        student_name.replace('_', ' ');

        if (status_tag == "P") {
            message = "ATTN: Attendance for your child, " + student_name + ", is marked as PRESENT. " + schoolName;
        } else if (status_tag == "A") {
            message = "ATTN: Attendance for your child, " + student_name + ", is marked as ABSENT. " + schoolName;
        }
        
        lcd.clear();
        lcd.print("Sending SMS to");
        lcd.setCursor(0, 1);
        lcd.print(student_name.substring(0, 16));
        sendSMS(phone_number, message, student_name);

    } else {
        Serial.println("ERR:Invalid_SMS_command_format."); 
    }
}

void initializeGSM() {
  lcd.clear();
  lcd.print("Initializing GSM");
  gsm.println("AT"); delay(500);
  gsm.println("ATE0"); delay(500);
  gsm.println("AT+CMGF=1"); delay(500);
  while(gsm.available()) { gsm.read(); } 
  Serial.println("INFO:GSM_module_initialized.");
}

void sendSMS(String number, String text, String recipientName) {
  Serial.print("INFO:Sending_SMS_to_");
  Serial.println(recipientName); 

  gsm.print("AT+CMGS=\"");
  gsm.print(number);
  gsm.println("\"");
  delay(1000);

  gsm.print(text);
  delay(100);
  gsm.write(26);

  long responseStartTime = millis();
  String response = "";
  
  while (millis() - responseStartTime < 30000) { 
    if (gsm.available()) {
      response += gsm.readString();
    }
    if (response.indexOf("OK") != -1) {
      Serial.println("SMS_SENT_OK," + recipientName); 
      delay(5000); // Crucial delay to allow network to process
      return;
    }
    if (response.indexOf("ERROR") != -1 || response.indexOf("FAIL") != -1) {
      Serial.println("SMS_SENT_FAIL," + recipientName); 
      return;
    }
  }
  
  Serial.println("ERR:Timeout_for_" + recipientName); 
}

// =========================================================================================
// == HELPER UTILITY                                                                    ==
// =========================================================================================
String getValue(String data, char separator, int index) {
  int found = 0;
  int strIndex[] = {0, -1};
  int maxIndex = data.length() - 1;
  for (int i = 0; i <= maxIndex && found <= index; i++) {
    if (data.charAt(i) == separator || i == maxIndex) {
      found++;
      strIndex[0] = strIndex[1] + 1;
      strIndex[1] = (i == maxIndex) ? i + 1 : i;
    }
  }
  return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}

    