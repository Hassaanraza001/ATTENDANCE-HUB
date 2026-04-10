
# 🌐 BioSync Box: Smart Wi-Fi & Auto-Boot Troubleshooting

Bhai, agar aapka box reboot hone par automatic nahi khul raha ya hotspot nahi dikha raha, toh niche diye gaye steps ko follow karein.

---

### 🛠️ Step 1: NetworkManager Enable Karein (Sabse Zaroori)
Bullseye OS mein NetworkManager ko manually enable karna padta hai. Terminal mein yeh command chalayein:

```bash
# NetworkManager ko default banayein
sudo raspi-config nonint do_netconf 2

# Interface ko NetworkManager ke hawale karein
sudo sed -i 's/managed=false/managed=true/g' /etc/NetworkManager/NetworkManager.conf

# Service restart karein
sudo systemctl restart NetworkManager
```

---

### 🛠️ Step 2: Directory & Permissions Fix
Confirm karein ki script ko chalne ki ijazat hai:

```bash
# Script ko executable banayein
chmod +x /home/pi/python_bridge/offline_setup/start_kiosk.sh

# Confirm karein ki autostart folder मौजूद hai
mkdir -p /home/pi/.config/autostart
```

---

### 🛠️ Step 3: Autostart Configuration
Nayi file banayein ya purani ko edit karein:
`nano /home/pi/.config/autostart/biosync.desktop`

Usme yeh **EXACT** text hona chahiye:
```text
[Desktop Entry]
Type=Application
Name=BioSync
Exec=/home/pi/python_bridge/offline_setup/start_kiosk.sh
Terminal=false
X-GNOME-Autostart-enabled=true
```

---

### 🔍 Zoom aur Hotspot Settings
1.  **Zoom Level**: Maine ise **80%** (`scale-factor=0.8`) par set kar diya hai taaki UI badi aur saaf dikhe.
2.  **Hotspot**: Hotspot ka naam **BioSync_Setup** hoga aur password **biosync123**. 
3.  **Note**: Agar hotspot nahi dikhta, toh terminal mein `sudo nmcli con delete BioSync_Setup` chala kar reboot karein.

Reboot karein aur 30 second wait karein. Ab hotspot pakka aayega!
