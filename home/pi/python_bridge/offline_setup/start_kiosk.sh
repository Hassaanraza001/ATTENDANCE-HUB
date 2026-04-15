
#!/bin/bash

# start_kiosk.sh - BioSync Master Launcher (v32.0 SINGLETON-FIX)
# This file ensures only ONE instance runs and cleans up hardware locks.

LOG_FILE="/home/pi/biosync_boot.log"
LOCK_FILE="/tmp/biosync.lock"

# Prevent double execution of this script
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null; then
        echo "Already running. Exiting." >> $LOG_FILE
        exit 1
    fi
fi
echo $$ > "$LOCK_FILE"

echo "--- BioSync Box Stealth Booting at $(date) ---" > $LOG_FILE

# 1. KILL ALL ZOMBIE PROCESSES (Forcefully)
sudo pkill -9 -f biosync_controller.py
sudo pkill -9 -f chromium-browser
rm -f /home/pi/.config/chromium/SingletonLock
sleep 5 # Wait for Serial Port to release

# 2. Force NetworkManager to stabilize
sudo systemctl restart NetworkManager
sleep 2

# 3. Cleanup conflict profiles
sudo nmcli con delete BioSync_Setup 2>/dev/null

# 4. Start Python Controller in background
cd /home/pi/python_bridge
/usr/bin/python3 -u biosync_controller.py >> $LOG_FILE 2>&1 &
echo "Python Bridge Active. PID: $!" >> $LOG_FILE

# 5. Launch Chromium IMMEDIATELY
export DISPLAY=:0

# Flags for professional kiosk behavior
CHROMIUM_FLAGS="--kiosk --noerrdialogs --disable-infobars --force-device-scale-factor=0.8 --disable-gpu --disable-software-rasterizer --incognito --check-for-update-interval=31536000 --no-sandbox --no-first-run --disable-pinch --disable-session-crashed-bubble --autoplay-policy=no-user-gesture-required"

echo "Launching Instant Splash Screen..." >> $LOG_FILE
chromium-browser $CHROMIUM_FLAGS http://localhost:5000 >> $LOG_FILE 2>&1
