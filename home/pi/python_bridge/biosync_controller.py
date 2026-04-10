
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

# Local Caching
slot_map = {} 
name_map = {} 
cached_user_id = None

if not os.path.exists(TEMPLATES_DIR): os.makedirs(TEMPLATES_DIR)

# ================= HELPERS =================
def get_serial():
    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'): return line.split(":")[1].strip()
    except: pass
    return "10000000741245e8" 

DEVICE_SERIAL = get_serial()

def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            return float(f.read()) / 1000.0
    except: return 0.0

# ================= WIFI SETUP SERVER =================
class CaptivePortalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=OFFLINE_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/':
            self.path = '/setup.html'
            
        if self.path == '/api/wifi-list':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                # Use sudo to avoid NetworkManager permission errors
                cmd = "sudo nmcli -t -f SSID,SIGNAL dev wifi"
                output = subprocess.check_output(cmd, shell=True, text=True)
                networks = []
                seen = set()
                for line in output.strip().split('\n'):
                    if line and ':' in line:
                        parts = line.split(':')
                        if len(parts) >= 2:
                            ssid, sig = parts[0], parts[1]
                            if ssid and ssid not in seen:
                                networks.append({"ssid": ssid, "signal": sig})
                                seen.add(ssid)
                self.wfile.write(json.dumps(networks).encode())
            except Exception as e:
                self.wfile.write(json.dumps([]).encode())
        else: return super().do_GET()

    def do_POST(self):
        if self.path == '/api/connect':
            length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            ssid, pwd = data.get('ssid'), data.get('password')
            
            print(f"Attempting to connect to {ssid}...")
            
            try:
                # Robust connection command
                cmd = f"sudo nmcli dev wifi connect '{ssid}' password '{pwd}'"
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20)
                
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success"}).encode())
                    print("Connection Successful. Rebooting...")
                    subprocess.Popen("sleep 3 && sudo reboot", shell=True)
                else:
                    self.send_response(401)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Incorrect Password"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())

def run_wifi_server():
    try:
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("0.0.0.0", HTTP_PORT), CaptivePortalHandler) as httpd:
            print(f"Wi-Fi Setup Server active on port {HTTP_PORT}")
            httpd.serve_forever()
    except Exception as e:
        print(f"Wifi Server Error: {e}")

# ================= HEARTBEAT THREAD =================
def heartbeat_loop():
    global db
    print("--- HEARTBEAT SERVICE STARTED ---")
    while True:
        try:
            if db:
                status_ref = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL)
                status_ref.set({
                    "last_online": firestore.SERVER_TIMESTAMP,
                    "cpu_temp": get_cpu_temp(),
                    "status": "online",
                    "hardware_ready": finger is not None,
                    "templates_stored": len(glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")))
                }, merge=True)
        except Exception as e:
            print(f"Heartbeat Error: {e}")
        time.sleep(30)

# ================= CORE LOGIC =================
def setup_firebase():
    global db
    key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
    if not os.path.exists(key_path):
        print(f"CRITICAL: {SERVICE_ACCOUNT_KEY_FILENAME} NOT FOUND")
        return False

    for attempt in range(10):
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("--- FIREBASE CONNECTED SUCCESSFULLY ---")
            return True
        except:
            print(f"Firebase attempt {attempt+1} failed.")
            time.sleep(5)
    return False

def setup_hardware():
    global finger, uart_port
    print("Connecting to Fingerprint Sensor...")
    try:
        if uart_port and uart_port.is_open: uart_port.close()
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        if finger.read_sysparam() == adafruit_fingerprint.OK:
            print("--- SENSOR CONNECTED SUCCESSFULLY ---")
            return True
    except: pass
    print("Sensor not found.")
    return False

def enroll(student_id, user_id, student_name):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        try:
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "REMOVE_FINGER", "enrolling_student_name": student_name})
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "PLACE_FINGER"})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "REMOVE_FINGER"})
            time.sleep(1)
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "PLACE_AGAIN"})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(2)
            if finger.create_model() == adafruit_fingerprint.OK:
                data = finger.get_fpdata("char", 1)
                if data:
                    with open(os.path.join(TEMPLATES_DIR, f"{student_id}.dat"), "wb") as f: f.write(bytearray(data))
                    db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id).update({"fingerprintID": "HYBRID_STORAGE"})
                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "SUCCESS"})
                else: db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "HARDWARE_ERROR"})
            else: db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "MATCH_ERROR"})
        except: db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "ERROR_IMAGE"})
        time.sleep(2)
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "IDLE"})
        is_enrolling = False

def sync_class(target_class, user_id):
    global slot_map, name_map
    with sensor_lock:
        try:
            finger.empty_library()
            slot_map.clear()
            name_map.clear()
            docs = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").where("className", "==", target_class).get()
            slot = 1
            for doc in docs:
                s_id = doc.id
                file_path = os.path.join(TEMPLATES_DIR, f"{s_id}.dat")
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f: template = list(f.read()[:512])
                    finger.send_fpdata(template, "char", 1)
                    if finger.store_model(slot) == adafruit_fingerprint.OK:
                        slot_map[slot] = s_id
                        name_map[s_id] = doc.to_dict().get("name", "Unknown")
                        slot += 1
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
                            if student_id and db and cached_user_id:
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
                        attendance_mode, cached_user_id = True, data.get("userId")
                        sync_class(data.get("className"), cached_user_id)
                    elif t == "END_ATTENDANCE":
                        attendance_mode = False
                    elif t == "REBOOT":
                        subprocess.Popen("sleep 2 && sudo reboot", shell=True)
                    elif t == "SHUTDOWN":
                        subprocess.Popen("sleep 2 && sudo shutdown -h now", shell=True)
                    elif t == "RESET_SENSOR":
                        with sensor_lock:
                            for f in glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")): os.remove(f)
                            finger.empty_library()
                            slot_map.clear()
                            name_map.clear()
                    change.document.reference.update({"status": "done"})
    if db:
        db.collection(COLLECTION_COMMANDS).where("deviceId", "==", DEVICE_SERIAL).where("status", "==", "pending").on_snapshot(on_snapshot)

if __name__ == "__main__":
    print(f"--- BioSync Unified Controller v2.0 [ID: {DEVICE_SERIAL}] ---")
    threading.Thread(target=run_wifi_server, daemon=True).start()
    
    setup_hardware()
    
    if setup_firebase():
        threading.Thread(target=heartbeat_loop, daemon=True).start()
        threading.Thread(target=listen_commands, daemon=True).start()
        threading.Thread(target=attendance_loop, daemon=True).start()
    else:
        print("Offline Mode: Direct Wi-Fi Selection active on Kiosk screen.")
    
    while True: time.sleep(1)
