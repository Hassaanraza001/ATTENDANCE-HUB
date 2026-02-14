
# 🚀 Vercel Environment Variables Setup Guide

Bhai, is guide ko step-by-step follow karein taaki aapka website Firebase Database se jud sake.

### Step 1: Apni Local Keys Nikalein
Sabse pehle apne computer par project folder kholiye aur **`.env`** file ko dhoondhiye. Isme aapki Firebase ki "Chaabiyan" (Keys) hain:
```
NEXT_PUBLIC_FIREBASE_PROJECT_ID="classmate-keeper-efub8"
NEXT_PUBLIC_FIREBASE_APP_ID="1:840709366322:web:4e9bdc768b6677371bd22b"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="classmate-keeper-efub8.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyDW6pokwv-i8ViCjGzs1M_rTQ6CUp9Q7rI"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="classmate-keeper-efub8.firebaseapp.com"
```

### Step 2: Vercel Dashboard Par Jayein
1. [Vercel.com](https://vercel.com/dashboard) par login karein.
2. Apne project par click karein jo aapne GitHub se import kiya hai.

### Step 3: Settings Khalein
1. Upar ke menu mein **"Settings"** tab par click karein.
2. Left side wale menu mein **"Environment Variables"** par click karein.

### Step 4: Keys Add Karein (Sabse Zaroori)
Yahan aapko ek-ek karke apni `.env` file wali values daalni hain:

1. **Key Box:** Yahan `.env` file se variable ka naam copy karein (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`).
2. **Value Box:** Yahan `=` ke baad wali poori value paste karein (e.g., `AIzaSy...`).
3. **Add Button:** "Add" par click karein.

**Ye saari keys add karni hain:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Step 5: Redeploy Karein
Keys add karne ke baad, **"Deployments"** tab mein jayein. Apni latest deployment ke bagal mein teen dots `...` par click karein aur **"Redeploy"** select karein.

---

### 💡 Pro Tip:
In keys ke aage **`NEXT_PUBLIC_`** hona bahut zaroori hai. Iske bina browser (Frontend) database se baat nahi kar payega.

Ab aapka system ready hai! Raspberry Pi par `/kiosk` wala link kholiye aur test kijiye.
