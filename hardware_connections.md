# Arduino UNO: SIM800L (SMS), AS608 (Fingerprint) aur Buzzer Ko Ek Saath Jodna

Bhai, is guide mein hum dekhenge ki ek hi Arduino UNO se SIM800L, AS608, aur ek Buzzer, teeno ko ek saath kaise connect karein.

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

SIM800L module ko bahut power chahiye hoti hai, jo Arduino nahi de sakta. Isliye hum iske liye alag se charger istemaal karenge. Fingerprint sensor aur buzzer ko power Arduino se mil sakti hai.

1.  **Mobile Charger Ko Taiyaar Karein:** Apne mobile charger ki USB cable ko aage se kaat lein. Humein sirf **LAL (Red, +5V)** aur **KAALE (Black, Ground)** taar chahiye.

2.  **SIM800L Ko Power Dein:**
    *   Charger ke **LAL (+) taar** ko SIM800L module ke **`VCC`** pin se jodein.
    *   Charger ke **KAALE (-) taar** ko SIM800L module ke **`GND`** pin se jodein.

3.  **Common Ground (Bahut Zaroori):** Ek aur jumper wire lein aur **Arduino ke `GND` pin** ko **SIM800L module ke `GND` pin** se jodein. Isse dono devices ka ground ek ho jaata hai.

---

## Part 2: Signal Connections (Arduino se sabhi modules)

Ab hum Arduino ko sabhi modules se data bhejne aur lene ke liye jodenge.

#### Buzzer Connections:
Isko hum Digital Pin 6 se control karenge.
*   **Buzzer ka Lamba Taar (+)** <--- **Arduino Digital Pin `6`**
*   **Buzzer ka Chhota Taar (-)** <--- **Arduino `GND`**

#### SIM800L (GSM Module) Connections:
Hum iske liye Pin 2 aur 3 ka istemaal karenge.
*   **Arduino Digital Pin `2`** <--- **SIM800L `TX`** pin
*   **Arduino Digital Pin `3`** <--- **SIM800L `RX`** pin

*(Yaad rakhein: Arduino ka RX hamesha module ke TX se judta hai, aur Arduino ka TX hamesha module ke RX se)*

#### AS608 (Fingerprint Sensor) Connections:
Hum iske liye Pin 4 aur 5 ka istemaal karenge.
*   **Arduino Digital Pin `4`** <--- Fingerprint Sensor ka **`TX`** pin (Green wire)
*   **Arduino Digital Pin `5`** <--- Fingerprint Sensor ka **`RX`** pin (White wire)

#### AS608 (Fingerprint Sensor) Power Connections:
Ise power hum seedhe Arduino se denge.
*   **Arduino `3.3V`** <--- Fingerprint Sensor ka **`VCC`** pin (Red wire)
*   **Arduino `GND`** <--- Fingerprint Sensor ka **`GND`** pin (Black wire)

---

### Final Check: Aapka Final Connection Aisa Dikhega

*   **Buzzer (+)** <--- **Arduino Digital Pin `6`**
*   **Buzzer (-)** <--- **Arduino `GND`**

*   **SIM800L `VCC`** <--- Charger ka **Lal Taar (+5V)**
*   **SIM800L `GND`** <--- Charger ka **Kaala Taar (GND)** + **Arduino `GND`** (Common Ground)
*   **SIM800L `TX`** <--- **Arduino Digital Pin `2`**
*   **SIM800L `RX`** <--- **Arduino Digital Pin `3`**

*   **Fingerprint Sensor `VCC`** (Red) <--- **Arduino `3.3V`**
*   **Fingerprint Sensor `GND`** (Black) <--- **Arduino `GND`**
*   **Fingerprint Sensor `TX`** (Green) <--- **Arduino Digital Pin `4`**
*   **Fingerprint Sensor `RX`** (White) <--- **Arduino Digital Pin `5`**

Is setup ke saath, aapka Arduino teeno cheezon ko control karne ke liye taiyaar hai!
