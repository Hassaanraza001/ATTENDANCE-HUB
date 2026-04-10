
# 🚀 BioSync Box: Professional "Zero-Desktop" Stealth Boot Guide

Bhai, is guide ko follow karne ke baad aapka Raspberry Pi bilkul ek factory-made hardware jaisa lagega. Boot hote waqt koi wallpaper, taskbar ya icons nahi dikhenge—sirf **BioSync Logo** aayega.

---

### 🛠️ Step 1: Terminal mein Setup Commands
Sabse pehle Raspberry Pi par terminal kholiye aur niche di gayi lines ko **ek-ek karke** copy-paste karke Enter dabayein:

```bash
# 1. Folder banayein (agar nahi hai) taaki error na aaye
mkdir -p /home/pi/.config/lxsession/LXDE-pi

# 2. Global settings ko local user settings mein copy karein
cp /etc/xdg/lxsession/LXDE-pi/autostart /home/pi/.config/lxsession/LXDE-pi/autostart 2>/dev/null

# 3. Taskbar (lxpanel) aur Desktop icons (pcmanfm) ko disable karein
sed -i 's/^@lxpanel/#@lxpanel/' /home/pi/.config/lxsession/LXDE-pi/autostart
sed -i 's/^@pcmanfm/#@pcmanfm/' /home/pi/.config/lxsession/LXDE-pi/autostart

# 4. BioSync Launcher ko startup mein add karein
# Note: Agar pehle se add hai, toh yeh line repeat nahi hogi
grep -qxF "@/home/pi/python_bridge/offline_setup/start_kiosk.sh" /home/pi/.config/lxsession/LXDE-pi/autostart || echo "@/home/pi/python_bridge/offline_setup/start_kiosk.sh" >> /home/pi/.config/lxsession/LXDE-pi/autostart
```

---

### 🛠️ Step 2: Boot Codes ko Saaf Karein (Stealth Mode)
Jab Pi chalu hota hai toh bahut saare codes (text) aate hain. Unhe hatane ke liye:

1. Terminal mein likhein: `sudo nano /boot/cmdline.txt`
2. Usme jo ek lambi line hai, uske ekdum **aakhiri mein** yeh words add kar dein (saare ek hi line mein):
   `consoleblank=1 logo.nologo quiet loglevel=3 vt.global_cursor_default=0 fastboot`
3. **Save karne ke liye**: `Ctrl+O` dabayein, phir `Enter`, aur band karne ke liye `Ctrl+X`.

---

### 🛠️ Step 3: Mouse Cursor Chhupayein
Mouse ka teer (arrow) gayab karne ke liye `unclutter` install karein:
1. Terminal mein: `sudo apt-get update && sudo apt-get install unclutter -y`
2. Phir autostart mein add karein:
   `echo "@unclutter -idle 0.1 -root" >> /home/pi/.config/lxsession/LXDE-pi/autostart`

---

### 💡 Result:
Ab jab aap box on karenge:
1. Ekdum black screen rahegi (no codes).
2. Pehla jhatka hi **BioSync Box** ka logo aur loading animation hoga.
3. Desktop ka taskbar, wallpaper, ya mouse teer kuch nahi dikhega.

**Ab `sudo reboot` karke jaadu dekhiye!**
