
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

# Mapping for matching
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
                cmd = "sudo nmcli -t -f SSID,SIGNAL dev wifi"
                output = subprocess.check_output(cmd, shell=True, text=True)
                networks = []
                seen = set()
                for line in output.strip().split('\n'):
                    if line and ':' in line:
                        parts = line.split(':')
                        ssid, sig = parts[0], parts[1]
                        if ssid and ssid not in seen:
                            networks.append({"ssid": ssid, "signal": sig})
                            seen.add(ssid)
                self.wfile.write(json.dumps(networks).encode())
            except Exception:
                self.wfile.write(json.dumps([]).encode())
        else: return super().do_GET()

    def do_POST(self):
        if self.path == '/api/connect':
            length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            ssid, pwd = data.get('ssid'), data.get('password')
            try:
                cmd = f"sudo nmcli dev wifi connect '{ssid}' password '{pwd}'"
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20)
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success"}).encode())
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
            httpd.serve_forever()
    except Exception: pass

# ================= HEARTBEAT THREAD =================
def heartbeat_loop():
    global db
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
        except Exception: pass
        time.sleep(30)

# ================= CORE LOGIC =================
def setup_firebase():
    global db
    key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
    if not os.path.exists(key_path): return False
    for attempt in range(10):
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
            db = firestore.client()
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                "enrollment_status": "IDLE", "scan_status": "idle", "enrolling_student_name": ""
            })
            return True
        except: time.sleep(5)
    return False

def setup_hardware():
    global finger, uart_port
    for attempt in range(5):
        try:
            if uart_port and uart_port.is_open: uart_port.close()
            uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
            finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
            if finger.read_sysparam() == adafruit_fingerprint.OK:
                finger.set_sysparam(param=5, value=1) 
                return True
        except: time.sleep(2)
    return False

def capture_single_finger_model(label, student_name):
    """Captures 2 scans for one finger and returns the model data"""
    start_time = time.time()
    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": f"PLACE_{label}", "enrolling_student_name": student_name})
    while finger.get_image() != adafruit_fingerprint.OK:
        if time.time() - start_time > 30: return None
        time.sleep(0.1)
    finger.image_2_tz(1)
    
    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": f"REMOVE_{label}"})
    while finger.get_image() != adafruit_fingerprint.NOFINGER: 
        if time.time() - start_time > 45: return None
        time.sleep(0.1)
    
    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": f"AGAIN_{label}"})
    while finger.get_image() != adafruit_fingerprint.OK:
        if time.time() - start_time > 60: return None
        time.sleep(0.1)
    finger.image_2_tz(2)
    
    if finger.create_model() == adafruit_fingerprint.OK:
        return finger.get_fpdata("char", 1)
    return None

def enroll(student_id, user_id, student_name):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        try:
            if not finger: setup_hardware()
            uart_port.reset_input_buffer()
            finger.empty_library()

            # --- SCAN FINGER 1 ---
            model1 = capture_single_finger_model("F1", student_name)
            if not model1: raise Exception("F1_FAIL")
            with open(os.path.join(TEMPLATES_DIR, f"{student_id}_f1.dat"), "wb") as f: f.write(bytearray(model1))
            
            # --- SCAN FINGER 2 ---
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "WAIT_F2"})
            time.sleep(3)
            model2 = capture_single_finger_model("F2", student_name)
            if not model2: raise Exception("F2_FAIL")
            with open(os.path.join(TEMPLATES_DIR, f"{student_id}_f2.dat"), "wb") as f: f.write(bytearray(model2))
            
            db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id).update({"fingerprintID": "HYBRID_DUAL"})
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "SUCCESS"})
        except Exception as e:
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": f"ERROR_{str(e)}"})
        
        time.sleep(3)
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "IDLE"})
        is_enrolling = False

def sync_class(target_class, user_id):
    global slot_map, name_map
    with sensor_lock:
        try:
            if not finger: setup_hardware()
            uart_port.reset_input_buffer()
            finger.empty_library()
            slot_map.clear()
            name_map.clear()
            
            docs = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").where("className", "==", target_class).get()
            
            slot = 1
            for doc in docs:
                s_id = doc.id
                s_name = doc.to_dict().get("name", "Unknown")
                for suffix in ["_f1", "_f2"]:
                    file_path = os.path.join(TEMPLATES_DIR, f"{s_id}{suffix}.dat")
                    if os.path.exists(file_path):
                        if slot > 127: break
                        with open(file_path, "rb") as f: data = f.read()
                        uart_port.reset_input_buffer()
                        finger.send_fpdata(list(data[:512]), "char", 1)
                        time.sleep(0.06)
                        if finger.store_model(slot) == adafruit_fingerprint.OK:
                            slot_map[slot] = s_id
                            name_map[s_id] = s_name
                            slot += 1
                        time.sleep(0.03)
            print(f"Synced {len(slot_map)} finger slots for {target_class}")
        except Exception: pass

def attendance_loop():
    global attendance_mode, cached_user_id
    while True:
        if not attendance_mode or is_enrolling or finger is None:
            time.sleep(0.1)
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
                                
                                # DIRECT FIRESTORE CHECK (No Local Cache)
                                doc_ref = db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students").document(student_id)
                                student_doc = doc_ref.get()
                                current_attendance = student_doc.to_dict().get("attendance", {})
                                
                                if current_attendance.get(today) == "present":
                                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                        "scan_status": "already-present", "last_student_name": student_name
                                    })
                                else:
                                    doc_ref.update({f"attendance.{today}": "present"})
                                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                        "scan_status": "success", "last_student_name": student_name
                                    })
                                
                                time.sleep(3)
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
                        else:
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "mismatch"})
                            time.sleep(3)
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except Exception: pass
        time.sleep(0.05)

def listen_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        global attendance_mode, cached_user_id
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                if data.get("status") == "pending":
                    t = data.get("type")
                    if t == "ENROLL":
                        s_id = data.get("studentId")
                        for f in glob.glob(os.path.join(TEMPLATES_DIR, f"{s_id}*")): os.remove(f)
                        threading.Thread(target=enroll, args=(s_id, data.get("userId"), data.get("studentName"))).start()
                    elif t == "START_ATTENDANCE":
                        attendance_mode, cached_user_id = True, data.get("userId")
                        threading.Thread(target=sync_class, args=(data.get("className"), cached_user_id)).start()
                    elif t == "END_ATTENDANCE":
                        attendance_mode = False
                    elif t == "REBOOT":
                        subprocess.Popen("sleep 2 && sudo reboot", shell=True)
                    elif t == "SHUTDOWN":
                        subprocess.Popen("sleep 2 && sudo shutdown -h now", shell=True)
                    elif t == "RESET_SENSOR":
                        with sensor_lock:
                            for f in glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")): os.remove(f)
                            if finger: finger.empty_library()
                            slot_map.clear()
                            name_map.clear()
                    change.document.reference.update({"status": "done"})
    if db:
        db.collection(COLLECTION_COMMANDS).where("deviceId", "==", DEVICE_SERIAL).where("status", "==", "pending").on_snapshot(on_snapshot)

if __name__ == "__main__":
    threading.Thread(target=run_wifi_server, daemon=True).start()
    setup_hardware()
    if setup_firebase():
        threading.Thread(target=heartbeat_loop, daemon=True).start()
        threading.Thread(target=listen_commands, daemon=True).start()
        threading.Thread(target=attendance_loop, daemon=True).start()
    while True: time.sleep(1)
