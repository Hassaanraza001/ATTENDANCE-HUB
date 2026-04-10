
import firebase_admin
from firebase_admin import credentials, firestore
import time
import threading
import serial
import adafruit_fingerprint
from datetime import datetime
import os
import glob
import http.server
import socketserver
import subprocess
import json

# ================= CONFIG =================
SERVICE_ACCOUNT_KEY_FILENAME = "serviceAccountKey.json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, "templates")
OFFLINE_DIR = os.path.join(SCRIPT_DIR, "offline_setup")

COLLECTION_COMMANDS = "kiosk_commands"
COLLECTION_STATUS = "system_status"
COLLECTION_INSTITUTES = "institutes"

HTTP_PORT = 5000
db = None
finger = None
uart_port = None
is_enrolling = False
attendance_mode = False
sensor_lock = threading.Lock()

# Local Caching to prevent DB reads in loops
slot_map = {} 
name_map = {} 
cached_user_id = None

if not os.path.exists(TEMPLATES_DIR): os.makedirs(TEMPLATES_DIR)

# ================= DEVICE ID =================
def get_serial():
    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'): return line.split(":")[1].strip()
    except: pass
    return "10000000741245e8" 

DEVICE_SERIAL = get_serial()

# ================= WIFI SETUP SERVER (LOCAL API) =================
class CaptivePortalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=OFFLINE_DIR, **kwargs)

    def do_GET(self):
        # Redirect mobile devices to our setup page
        if any(x in self.path for x in ["generate_204", "redirect", "success.html", "hotspot-detect"]):
            self.send_response(302)
            self.send_header('Location', f'http://10.42.0.1:{HTTP_PORT}/')
            self.end_headers()
            return

        if self.path == '/api/wifi-list':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                cmd = "nmcli -t -f SSID,SIGNAL dev wifi"
                output = subprocess.check_output(cmd, shell=True, text=True)
                networks = []
                seen = set()
                for line in output.strip().split('\n'):
                    if line and ':' in line:
                        ssid, sig = line.split(':')
                        if ssid and ssid not in seen and ssid != "BioSync_Setup":
                            networks.append({"ssid": ssid, "signal": sig})
                            seen.add(ssid)
                self.wfile.write(json.dumps(networks).encode())
            except: self.wfile.write(json.dumps([]).encode())
        else: return super().do_GET()

    def do_POST(self):
        if self.path == '/api/connect':
            length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            ssid, pwd = data.get('ssid'), data.get('password')
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())
            print(f"Connecting to {ssid}...")
            subprocess.Popen(f"sleep 2 && nmcli dev wifi connect '{ssid}' password '{pwd}'", shell=True)

def run_wifi_server():
    try:
        with socketserver.TCPServer(("0.0.0.0", HTTP_PORT), CaptivePortalHandler) as httpd:
            print(f"Wi-Fi Config Server active on port {HTTP_PORT}")
            httpd.serve_forever()
    except Exception as e:
        print(f"Wifi Server Error: {e}")

# ================= FIREBASE & HARDWARE LOGIC =================
def setup_firebase():
    global db, cached_user_id
    try:
        key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
        if not os.path.exists(key_path): return False
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        return True
    except: return False

def setup_hardware():
    global finger, uart_port
    try:
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        return True
    except: return False

def update_status(msg, name=None):
    try:
        data = {"enrollment_status": msg}
        if name: data["enrolling_student_name"] = name
        if db: db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set(data, merge=True)
    except: pass

def enroll(student_id, user_id, student_name):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        try:
            update_status("REMOVE_FINGER", student_name)
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            update_status("PLACE_FINGER", student_name)
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(1)
            update_status("REMOVE_FINGER", student_name)
            time.sleep(1)
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            update_status("PLACE_AGAIN", student_name)
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(2)
            if finger.create_model() == adafruit_fingerprint.OK:
                data = finger.get_fpdata("char", 1)
                if data:
                    with open(os.path.join(TEMPLATES_DIR, f"{student_id}.dat"), "wb") as f: f.write(bytearray(data))
                    db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id).update({"fingerprintID": "HYBRID_STORAGE"})
                    update_status("SUCCESS", student_name)
                else: update_status("HARDWARE_ERROR")
            else: update_status("MATCH_ERROR")
        except: update_status("ERROR_IMAGE")
        time.sleep(2)
        update_status("IDLE")
        is_enrolling = False

def sync_class(target_class, user_id):
    global slot_map, name_map, cached_user_id
    with sensor_lock:
        try:
            finger.empty_library()
            slot_map.clear()
            name_map.clear()
            students_ref = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students")
            docs = students_ref.where("className", "==", target_class).get()
            
            slot = 1
            for doc in docs:
                s_id = doc.id
                s_data = doc.to_dict()
                file_path = os.path.join(TEMPLATES_DIR, f"{s_id}.dat")
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f: template = list(f.read()[:512])
                    finger.send_fpdata(template, "char", 1)
                    if finger.store_model(slot) == adafruit_fingerprint.OK:
                        slot_map[slot] = s_id
                        name_map[s_id] = s_data.get("name", "Unknown")
                        slot += 1
            print(f"Synced {slot-1} students for {target_class}")
        except: pass

def attendance_loop():
    global attendance_mode, cached_user_id
    while True:
        if not attendance_mode or is_enrolling:
            time.sleep(0.5)
            continue
        with sensor_lock:
            try:
                if finger.get_image() == adafruit_fingerprint.OK:
                    if finger.image_2_tz(1) == adafruit_fingerprint.OK:
                        if finger.finger_search() == adafruit_fingerprint.OK:
                            student_id = slot_map.get(finger.finger_id)
                            student_name = name_map.get(student_id, "Unknown")
                            if student_id and db:
                                today = datetime.now().strftime("%Y-%m-%d")
                                db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students").document(student_id).update({f"attendance.{today}": "present"})
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "success", "last_student_name": student_name})
                                time.sleep(4)
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except: pass
        time.sleep(0.1)

def listen_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        global attendance_mode, cached_user_id
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                if data.get("status") == "pending":
                    t = data.get("type")
                    if t == "ENROLL":
                        threading.Thread(target=enroll, args=(data.get("studentId"), data.get("userId"), data.get("studentName"))).start()
                    elif t == "START_ATTENDANCE":
                        attendance_mode = True
                        cached_user_id = data.get("userId")
                        sync_class(data.get("className"), cached_user_id)
                    elif t == "END_ATTENDANCE":
                        attendance_mode = False
                        update_status("IDLE")
                    change.document.reference.update({"status": "done"})

    if db:
        query = db.collection(COLLECTION_COMMANDS).where("deviceId", "==", DEVICE_SERIAL).where("status", "==", "pending")
        query.on_snapshot(on_snapshot)

if __name__ == "__main__":
    print(f"--- BioSync Unified Controller v1.0 [ID: {DEVICE_SERIAL}] ---")
    threading.Thread(target=run_wifi_server, daemon=True).start()
    
    if setup_hardware():
        if setup_firebase():
            threading.Thread(target=listen_commands, daemon=True).start()
            threading.Thread(target=attendance_loop, daemon=True).start()
            print("Online Systems Started.")
        else: print("Offline Mode: Firebase unavailable. Wi-Fi Server only.")
        while True: time.sleep(1)
    else: print("Hardware Error: Check Serial/Sensor connections.")
