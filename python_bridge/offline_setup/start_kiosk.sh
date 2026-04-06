#!/bin/bash

# start_kiosk.sh - Yeh script decide karta hai ki Online website kholni hai ya Offline QR code.

# 1. System ko stable hone ke liye 5 second ka wait
sleep 5

# 2. Check for Internet (Google ko ping karke dekhna)
if ping -c 1 8.8.8.8 &> /dev/null
then
    echo "Internet Hai! Launching Vercel Website..."
    # Yahan apni Vercel URL dalien
    chromium-browser --kiosk --noerrdialogs --disable-infobars https://attendance-hub-alpha.vercel.app/kiosk
else
    echo "Internet Nahi Hai! Launching Local QR Setup..."
    
    # 3. Browser mein LOCAL file kholo (Iske liye internet nahi chahiye)
    # Note: Make sure setup.html is in /home/pi/offline_setup/
    chromium-browser --kiosk --noerrdialogs --disable-infobars file:///home/pi/offline_setup/setup.html
fi