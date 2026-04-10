
#!/bin/bash

# start_kiosk.sh - BioSync Master Launcher (v16.0 BULLSEYE-HOTSPOT-FIX)
LOG_FILE="/home/pi/biosync_boot.log"
echo "--- BioSync Box Booting at $(date) ---" > $LOG_FILE

# 1. Ensure NetworkManager is active
echo "Ensuring NetworkManager is active..." >> $LOG_FILE
sudo systemctl start NetworkManager
sudo systemctl enable NetworkManager
sleep 5

# 2. Wait for Desktop session
echo "System services stabilized. Starting Master Controller..." >> $LOG_FILE
sleep 10

# 3. CD to ensure relative paths
cd /home/pi/python_bridge
echo "Current working directory: $(pwd)" >> $LOG_FILE

# 4. Start Python Controller (Unbuffered for logs)
/usr/bin/python3 -u biosync_controller.py >> $LOG_FILE 2>&1 &
PYTHON_PID=$!
echo "Python controller initiated with PID: $PYTHON_PID" >> $LOG_FILE

# 5. Network Check Loop
echo "Checking Internet Connectivity..." >> $LOG_FILE
MAX_RETRIES=15
COUNT=0
CONNECTED=false

while [ $COUNT -lt $MAX_RETRIES ]; do
    if ping -c 1 8.8.8.8 &> /dev/null; then
        echo "Internet Detected on attempt $COUNT!" >> $LOG_FILE
        CONNECTED=true
        break
    fi
    echo "Attempt $COUNT: Waiting for network..." >> $LOG_FILE
    sleep 2
    ((COUNT++))
done

# 6. Launch Kiosk (Zoom set to 80%)
export DISPLAY=:0
CHROMIUM_FLAGS="--kiosk --noerrdialogs --disable-infobars --force-device-scale-factor=0.8 --disable-gpu --disable-software-rasterizer --incognito --check-for-update-interval=31536000 --no-sandbox"

if [ "$CONNECTED" = true ]; then
    echo "Launching Cloud Dashboard..." >> $LOG_FILE
    # Stop setup hotspot if active
    sudo nmcli con down BioSync_Setup 2>/dev/null
    sleep 2
    chromium-browser $CHROMIUM_FLAGS "https://attendance-hub-dtja.vercel.app/kiosk?deviceId=10000000741245e8" >> $LOG_FILE 2>&1
else
    echo "Timeout: Activating Offline Setup Hotspot..." >> $LOG_FILE
    
    # --- HOTSPOT FORCE START SEQUENCE ---
    sudo rfkill unblock wifi
    sudo nmcli device disconnect wlan0 2>/dev/null
    sudo nmcli radio wifi off
    sleep 1
    sudo nmcli radio wifi on
    sleep 2
    
    # Try to bring up existing connection or create new one
    sudo nmcli con up BioSync_Setup 2>/dev/null || sudo nmcli device wifi hotspot ssid BioSync_Setup password "biosync123"
    
    echo "Launching Local Setup Page..." >> $LOG_FILE
    chromium-browser $CHROMIUM_FLAGS http://localhost:5000 >> $LOG_FILE 2>&1
fi
