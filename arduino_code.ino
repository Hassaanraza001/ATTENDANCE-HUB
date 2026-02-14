// =========================================================================================
// == ARDUINO CODE FOR BULK SMS (ELECTRON APP VERSION) WITH LCD DISPLAY ==
// =========================================================================================

// --- LIBRARIES ---
#include <SoftwareSerial.h>
#include <LiquidCrystal.h> 

// --- LCD CONFIGURATION ---
LiquidCrystal lcd(7, 8, 9, 10, 11, 12); // RS, EN, D4, D5, D6, D7

// --- GSM CONFIGURATION ---
SoftwareSerial gsm(2, 3); 

// --- GLOBAL VARIABLES ---
String inputBuffer = "";      
bool processingCommand = false; 
unsigned long smsStartTime = 0;
int totalSmsSent = 0;
int totalSmsFailed = 0;
bool gsmReady = false;
int signalStrength = -1;
bool simPresent = false;

// Custom characters
byte smiley[8] = {
  B00000,
  B10001,
  B00000,
  B00000,
  B10001,
  B01110,
  B00000,
  B00000
};

byte sadFace[8] = {
  B00000,
  B10001,
  B00000,
  B00000,
  B01110,
  B10001,
  B00000,
  B00000
};

byte antenna[8] = {
  B00100,
  B01010,
  B01010,
  B01110,
  B00100,
  B00100,
  B00100,
  B00000
};

// =========================================================================================
// == SETUP: Runs once when the Arduino starts up                                       ==
// =========================================================================================
void setup() {
  Serial.begin(9600);       
  gsm.begin(9600);          
  inputBuffer.reserve(512); 
  
  // Initialize LCD display
  lcd.begin(16, 2); 
  
  // Create custom characters
  lcd.createChar(0, smiley);
  lcd.createChar(1, sadFace);
  lcd.createChar(2, antenna);
  
  // Show booting up animation for 3 seconds
  showBootingAnimation();
  
  // Show welcome message
  lcd.clear();
  lcd.print("GPT ATTENDANCE");
  lcd.setCursor(0, 1);
  lcd.print("  ALERT SYSTEM ");
  delay(2000);
  
  // Initialize the GSM module
  initializeGSM();

  // Show ready screen
  showReadyScreen();
  
  Serial.println("ARDUINO_READY"); 
  Serial.println("Waiting for commands from the app...");
}

// =========================================================================================
// == MAIN LOOP: Runs continuously after setup()                                      ==
// =========================================================================================
void loop() {
  // Check signal strength every 3 seconds
  static unsigned long lastSignalCheck = 0;
  if (millis() - lastSignalCheck > 3000) {
    checkSignalStrength();
    lastSignalCheck = millis();
  }
  
  // Step 1: Read all available data from Serial and add it to our buffer
  while (Serial.available()) {
    char c = Serial.read();
    inputBuffer += c;
  }

  // Step 2: If we are not busy with another SMS and there's data in the buffer, process it
  if (!processingCommand && inputBuffer.length() > 0) {
    
    // Find the first complete command in the buffer (it must end with a newline '\n')
    int newlineIndex = inputBuffer.indexOf('\n');
    
    // If a complete command is found...
    if (newlineIndex != -1) {
      processingCommand = true; // Set flag to 'busy'

      // Extract the first command from the buffer
      String command = inputBuffer.substring(0, newlineIndex);
      command.trim(); // Remove any extra whitespace

      // IMPORTANT: Remove the processed command from the beginning of the buffer
      inputBuffer = inputBuffer.substring(newlineIndex + 1);

      // Only process if the command is not empty
      if (command.length() > 0) {
          Serial.print("Processing Command: ");
          Serial.println(command); 
          
          String status_tag = getValue(command, ',', 0);
          String student_name = getValue(command, ',', 1);
          String phone_number = getValue(command, ',', 2);
          
          if (status_tag.length() > 0 && student_name.length() > 0 && phone_number.length() > 0) {
            String message = "";
            if (status_tag == "P") {
              message = "Dear Parent, your child " + student_name + " is PRESENT today. Regards, School";
            } else if (status_tag == "A") {
              message = "Dear Parent, your child " + student_name + " is ABSENT today. Regards, School";
            }
            
            // Update LCD with sending status
            showSendingAnimation(student_name);
            
            // Record start time for SMS sending
            smsStartTime = millis();
            
            sendSMS(phone_number, message);
    
          } else {
            Serial.println("ERR: Invalid command format. Skipping."); 
          }
      }
      
      processingCommand = false; 
    }
  }
  
  // Show elapsed time on second line when SMS is being sent
  if (smsStartTime > 0) {
    unsigned long elapsed = (millis() - smsStartTime) / 1000;
    lcd.setCursor(12, 1);
    lcd.print("T:");
    if (elapsed < 10) lcd.print("0");
    lcd.print(elapsed);
    lcd.print("s");
  }
}

// =========================================================================================
// == HELPER FUNCTIONS                                                                ==
// =========================================================================================

/**
 * @brief Shows booting up animation for 3 seconds
 */
void showBootingAnimation() {
  lcd.clear();
  lcd.print("BOOTING UP");
  
  unsigned long startTime = millis();
  int dotCount = 0;
  
  while (millis() - startTime < 3000) {
    lcd.setCursor(10, 0);
    for (int i = 0; i < 3; i++) {
      if (i < dotCount) {
        lcd.print(".");
      } else {
        lcd.print(" ");
      }
    }
    
    lcd.setCursor(0, 1);
    int progress = ((millis() - startTime) * 16) / 3000;
    for (int i = 0; i < 16; i++) {
      if (i < progress) {
        lcd.print("#");
      } else {
        lcd.print(" ");
      }
    }
    
    dotCount = (dotCount + 1) % 4;
    delay(300);
  }
  
  lcd.clear();
}

/**
 * @brief Shows sending animation with student name
 */
void showSendingAnimation(String name) {
  lcd.clear();
  lcd.print("SENDING SMS ");
  lcd.write(byte(2)); // Antenna
  
  String displayName = name;
  if (displayName.length() > 12) {
    displayName = displayName.substring(0, 10) + "..";
  }
  
  lcd.setCursor(0, 1);
  lcd.print("To: ");
  lcd.print(displayName);
}

/**
 * @brief Shows ready screen
 */
void showReadyScreen() {
  lcd.clear();
  lcd.print(" READY ");
  lcd.write(byte(0)); // Smiley
  lcd.print(" SMS:");
  lcd.print(totalSmsSent);
  
  lcd.setCursor(0, 1);
  if (!simPresent) {
    lcd.print("NO SIM!");
  } else if (signalStrength == -1) {
    lcd.print("Signal: ---");
  } else {
    lcd.print("Signal:");
    lcd.print(signalStrength);
    lcd.print("%");
  }
}

/**
 * @brief Shows success animation
 */
void showSuccessAnimation() {
  lcd.clear();
  lcd.print(" SUCCESS! ");
  lcd.write(byte(0));
  lcd.setCursor(0, 1);
  lcd.print("SMS Delivered!");
  delay(1500);
}

/**
 * @brief Shows error animation
 */
void showErrorAnimation(String message) {
  lcd.clear();
  lcd.print("ERROR! ");
  lcd.write(byte(1));
  lcd.setCursor(0, 1);
  lcd.print(message);
  
  for (int i = 0; i < 3; i++) {
    lcd.noDisplay();
    delay(200);
    lcd.display();
    delay(200);
  }
}

/**
 * @brief Checks GSM signal strength
 */
void checkSignalStrength() {
  if (!gsmReady) return;
  
  gsm.println("AT+CSQ");
  delay(200);
  
  String response = "";
  long startTime = millis();
  
  while (millis() - startTime < 1000) {
    if (gsm.available()) {
      response += (char)gsm.read();
    }
  }
  
  if (response.indexOf("+CSQ:") == -1) {
    simPresent = false;
    signalStrength = -1;
    return;
  }
  
  simPresent = true;
  int csqIndex = response.indexOf("+CSQ:");
  if (csqIndex != -1) {
    int commaIndex = response.indexOf(",", csqIndex);
    if (commaIndex != -1) {
      String sigStr = response.substring(csqIndex + 6, commaIndex);
      sigStr.trim();
      if (sigStr.length() > 0) {
        int rssi = sigStr.toInt();
        if (rssi == 99) {
          signalStrength = 0;
        } else if (rssi <= 31 && rssi >= 0) {
          signalStrength = map(rssi, 0, 31, 0, 100);
        } else {
          signalStrength = 0;
        }
      }
    }
  }
  
  if (smsStartTime == 0) {
    showReadyScreen();
  }
}

/**
 * @brief Initializes the GSM module with basic AT commands.
 */
void initializeGSM() {
  lcd.clear();
  lcd.print("Initializing GSM");
  lcd.setCursor(0, 1);
  lcd.print("Module...");
  Serial.println("Initializing GSM module...");
  
  gsm.println("AT"); 
  delay(1000);
  gsm.println("ATE0");
  delay(1000);
  gsm.println("AT+CMGF=1");
  delay(1000);
  
  while(gsm.available()) { gsm.read(); } 
  
  gsmReady = true;
  checkSignalStrength();
  Serial.println("GSM module initialized.");
}

/**
 * @brief Sends an SMS and sends a clean response back to Serial.
 */
void sendSMS(String number, String text) {
  if (!simPresent) {
    showErrorAnimation("NO SIM CARD!");
    delay(2000);
    showReadyScreen();
    return;
  }
  
  Serial.print("Sending SMS to: ");
  Serial.println(number); 

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
      response = gsm.readString();
      if (response.indexOf("OK") != -1) {
        Serial.println("SMS_SENT_OK"); 
        totalSmsSent++;
        showSuccessAnimation();
        smsStartTime = 0;
        
        // 3-second delay between SMS
        lcd.clear();
        lcd.print("PLEASE WAIT");
        lcd.setCursor(0, 1);
        lcd.print("NEXT SMS IN: 3s");
        for (int i = 3; i > 0; i--) {
          lcd.setCursor(12, 1);
          lcd.print(i);
          lcd.print("s");
          delay(1000);
        }
        
        showReadyScreen();
        return;
      }
      if (response.indexOf("ERROR") != -1 || response.indexOf("FAIL") != -1) {
        Serial.println("SMS_SENT_FAIL"); 
        totalSmsFailed++;
        showErrorAnimation("SMS Failed!");
        delay(2000);
        smsStartTime = 0;
        showReadyScreen();
        return;
      }
    }
  }
  
  Serial.println("ERR: Timeout waiting for SMS confirmation."); 
  totalSmsFailed++;
  showErrorAnimation("Timeout Error!");
  delay(2000);
  smsStartTime = 0;
  showReadyScreen();
}

/**
 * @brief Parses a string to get a value based on a separator.
 */
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