
#!/bin/bash

# start_kiosk.sh - BioSync Master Launcher (v28.0 STEALTH BOOT FIX)
# This file ensures immediate splash launch and reliable network check.

LOG_FILE="/home/pi/biosync_boot.log"
echo "--- BioSync Box Stealth Booting at $(date) ---" > $LOG_FILE

# 1. Force NetworkManager to stabilize
sudo systemctl restart NetworkManager
sleep 3

# 2. Cleanup conflict profiles
sudo nmcli con delete BioSync_Setup 2>/dev/null

# 3. Start Python Controller in background
cd /home/pi/python_bridge
/usr/bin/python3 -u biosync_controller.py >> $LOG_FILE 2>&1 &
echo "Python Bridge Active." >> $LOG_FILE

# 4. Launch Chromium IMMEDIATELY (Zero Delay)
export DISPLAY=:0

# Flags for professional kiosk behavior
CHROMIUM_FLAGS="--kiosk --noerrdialogs --disable-infobars --force-device-scale-factor=1.0 --disable-gpu --disable-software-rasterizer --incognito --check-for-update-interval=31536000 --no-sandbox --no-first-run --disable-pinch --hide-scrollbars --disable-session-crashed-bubble"

echo "Launching Instant Splash Screen..." >> $LOG_FILE
# Load the local setup page which handles the smart redirect logic
chromium-browser $CHROMIUM_FLAGS http://localhost:5000 >> $LOG_FILE 2>&1
