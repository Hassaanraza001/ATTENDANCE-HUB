
# 🚀 Unlimited Attendance Box: Zero to 20,000+ Templates Setup Guide

Bhai, ye system AS608 sensor ki 127-slot limit ko khatam karke Raspberry Pi ki local memory (SD Card) par fingerprints store karta hai. Isse aap 20,000 se zyada students ka data manage kar sakte hain.

---

### Step 1: Python & Environment Check
Raspberry Pi OS mein Python pre-installed hota hai. Bas check karein:
1. Terminal kholiye aur type karein: `python3 --version`

### Step 2: Hardware Wiring (AS608 Sensor)
Pins ko niche diye gaye table ke hisaab se jodein (Pi band karke):

| Sensor Pin | Color | Pi Pin Number | Function |
| :--- | :--- | :--- | :--- |
| **VCC** | Red | **Pin 1** | 3.3V Power |
| **GND** | Black | **Pin 6** | Ground |
| **TX** | Green | **Pin 10** | UART RX (Pi receives) |
| **RX** | White | **Pin 8** | UART TX (Pi transmits) |

### Step 3: Enable UART (Serial Interface)
Sensor se baat karne ke liye ye settings zaroori hain:
1. Terminal mein likhein: `sudo raspi-config`
2. `Interface Options` -> `Serial Port` mein jayein.
3. "Login shell over serial?" -> **NO**
4. "Hardware serial port enabled?" -> **YES**
5. **Reboot** karein: `sudo reboot`

### Step 4: Install Necessary Libraries (The "Bookworm" Fix)
Agar aapko `externally-managed-environment` wala error aaye, toh ye command chalaein:
```bash
sudo apt-get update
# Note: `--break-system-packages` flag naye Pi OS ke liye zaroori hai.
pip3 install firebase-admin adafruit-circuitpython-fingerprint pyserial --break-system-packages
```

### Step 5: Connect Database (Firebase Key)
1. **Firebase Console** -> Project Settings -> Service Accounts.
2. **Generate New Private Key** par click karein.
3. Downloaded file ka naam badal kar `serviceAccountKey.json` rakhein.
4. Ise Pi ke usi folder mein rakhein jahan `firebase_bridge.py` hai.

### Step 6: Run the Bridge
1. `firebase_bridge.py` kholiye aur `ACTIVE_USER_ID` mein apni dashboard wali ID daaliye.
2. Terminal mein script chalaein:
   ```bash
   python3 firebase_bridge.py
   ```

### Step 7: Launch Kiosk UI
1. Pi ke Chromium browser mein apna URL kholiye: `https://your-app.vercel.app/kiosk`.
2. Booting animation (6s) dekhne ke baad, dashboard se code enter karein.

---

### 💡 Why 20,000+ templates work?
1. **Enrollment:** Script sensor se fingerprint data (template) download karti hai aur Pi ki SD card par `.dat` file ki tarah save karti hai.
2. **Matching:** Scan ke waqt script local folder se templates utha kar sensor ke buffer mein upload karti hai aur match karti hai.
3. **Storage:** Sensor ki memory (127) ki jagah hum Pi ki hard drive use kar rahe hain.
