# 🌐 BioSync Box: Professional Auto-Hotspot Setup Guide

Bhai, yeh guide aapke hardware box ko "Smart" banane ke liye hai. Agar school mein internet na ho, toh box apne aap screen par QR code dikhayega aur admin ke phone se Wi-Fi set ho jayega.

---

### Step 1: Network Tools Install Karein
Raspberry Pi terminal mein yeh likhein taaki Pi Wi-Fi ko control kar sake:
```bash
sudo apt update
sudo apt install network-manager -y
sudo systemctl enable --now NetworkManager
```

### Step 2: WiFi-Connect Engine Install Karein
Yeh tool "Hotspot" banayega jab internet nahi milega:
```bash
curl -L https://github.com/balena-io/wifi-connect/raw/master/scripts/raspbian-install.sh | bash
```

### Step 3: Files ko Sahi Jagah Rakhein
1. Raspberry Pi ki `/home/pi/` folder mein ek naya folder banayein: `offline_setup`.
2. Uske andar hamari `setup.html` file copy kar dein.
3. Usi folder mein `start_kiosk.sh` ko rakhein.
4. Terminal mein yeh command chalayein taaki script "Execute" ho sake:
```bash
chmod +x /home/pi/offline_setup/start_kiosk.sh
```

### Step 4: Auto-Start Set Karein
Humein Pi ko batana hai ki start hote hi hamara script chalana hai:
1. Terminal mein likhein: `nano /home/pi/.config/lxsession/LXDE-pi/autostart`
2. Sabse neeche yeh line jod dein:
`@/home/pi/offline_setup/start_kiosk.sh`
3. Save karne ke liye: `Ctrl+O` fir `Enter`, aur bahar aane ke liye `Ctrl+X`.

---

### 💡 Yeh Kaam Kaise Karega?
1. **Scenario A (Wi-Fi hai)**: Pi on hua -> Internet check kiya -> Success -> Seedha Vercel wali website khul gayi.
2. **Scenario B (Wi-Fi nahi hai)**: Pi on hua -> Internet check kiya -> Fail -> Screen par QR Code dikha (`setup.html` se). 
   - Admin ne phone se QR scan kiya.
   - Phone par Wi-Fi list aayi, apna password dala.
   - Box apne aap connect ho kar normal chalne laga.

---

### 📡 QR Code Details:
- **SSID**: `BioSync_Setup`
- **Password**: None (Open)
- **Function**: Phone connects to Pi automatically to open setup portal.