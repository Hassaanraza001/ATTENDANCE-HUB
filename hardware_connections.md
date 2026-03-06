# Arduino UNO: SIM800L (SMS), AS608 (Fingerprint) aur Buzzer Ko Ek Saath Jodna

Bhai, is guide mein humne pins ko aapke working test setup ke hisaab se update kiya hai (Fingerprint on Pins 2, 3).

---

### Zaroori Samaan:
1.  Arduino UNO
2.  SIM800L GSM Module
3.  **AS608 Fingerprint Sensor**
4.  **Piezo Buzzer**
5.  Ek chalu SIM card
6.  Jumper wires
7.  **Alag se Power Supply:** 5V 2A ka mobile charger (sirf SIM800L ke liye).

---

## Part 1: Power Supply Connections (Sabse Zaroori)

1.  **SIM800L Power:** Charger ke **LAL (+) taar** ko `VCC` se aur **KAALE (-) taar** ko `GND` se jodein.
2.  **Common Ground:** Arduino ke `GND` ko SIM800L ke `GND` se jodein (Dono grounds ek hone chahiye).

---

## Part 2: Signal Connections (New Working Pinout)

#### AS608 (Fingerprint Sensor) - UPDATED:
Isko ab Pin 2 aur 3 par lagaya gaya hai kyunki yeh testing mein sahi kaam kar raha hai.
*   Fingerprint Sensor ka **`TX` (Green wire)** <--- **Arduino Digital Pin `2`**
*   Fingerprint Sensor ka **`RX` (White wire)** <--- **Arduino Digital Pin `3`**
*   **VCC (Red):** Arduino `3.3V`
*   **GND (Black):** Arduino `GND`

#### SIM800L (GSM Module) - MOVED:
Iske pins ko badal kar 4 aur 5 kar diya gaya hai.
*   SIM800L ka **`TX`** <--- **Arduino Digital Pin `4`**
*   SIM800L ka **`RX`** <--- **Arduino Digital Pin `5`**

#### Buzzer Connections:
*   **Buzzer (+) Lamba Taar** <--- **Arduino Digital Pin `6`**
*   **Buzzer (-) Chhota Taar** <--- **Arduino `GND`**

#### LCD Display (16x2):
*   RS: Pin 7, EN: Pin 8, D4: Pin 9, D5: Pin 10, D6: Pin 11, D7: Pin 12

---

### Summary:
Ab aapka fingerprint sensor perfectly detect hona chahiye kyunki code ab wahi pins use kar raha hai jo aapne successfully test kiye hain!