
import firebase_admin
from firebase_admin import credentials, firestore
import time
import threading
import serial
import adafruit_fingerprint
from datetime import datetime
import os
import glob

# ================= CONFIG =================
SERVICE_ACCOUNT_KEY_FILENAME = "serviceAccountKey.json"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, "templates")

COLLECTION_COMMANDS = "kiosk_commands"
COLLECTION_STATUS = "system_status"
COLLECTION_INSTITUTES = "institutes"

HEARTBEAT_INTERVAL = 60 

db = None
finger = None
uart_port = None

is_enrolling = False
attendance_mode = False
sensor_lock = threading.Lock()

slot_map = {} 
name_map = {} 
cached_user_id = None

if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

def get_serial():
    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.split(":")[1].strip()
    except: pass
    return "10000000741245e8" 

DEVICE_SERIAL = get_serial()

def setup_firebase():
    global db, cached_user_id
    try:
        key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
        if not os.path.exists(key_path): return False
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        status_ref = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL)
        doc = status_ref.get()
        if doc.exists:
            cached_user_id = doc.to_dict().get("userId")
        return True
    except: return False

def setup_hardware():
    global finger, uart_port
    try:
        if uart_port: uart_port.close()
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        finger.set_sysparam(param=5, value=1)
        return True
    except: return False

def sync_templates_to_sensor(target_class=None, user_id=None):
    global slot_map, name_map, cached_user_id
    if user_id: cached_user_id = user_id
    with sensor_lock:
        try:
            finger.empty_library() 
            slot_map.clear()
            name_map.clear()
            
            if cached_user_id and target_class:
                students_ref = db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students")
                docs = students_ref.where("className", "==", target_class).get() 
                
                current_slot = 1
                for doc in docs:
                    s_id = doc.id
                    s_name = doc.to_dict().get("name", "Unknown")
                    
                    for suffix in ["_f1", "_f2"]:
                        file_path = os.path.join(TEMPLATES_DIR, f"{s_id}{suffix}.dat")
                        if os.path.exists(file_path):
                            if current_slot > 127: break
                            with open(file_path, "rb") as f: data = f.read()
                            finger.send_fpdata(list(data[:512]), "char", 1)
                            time.sleep(0.06)
                            if finger.store_model(current_slot) == adafruit_fingerprint.OK:
                                slot_map[current_slot] = s_id
                                name_map[s_id] = s_name
                                current_slot += 1
                                time.sleep(0.03)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
        except Exception: pass

def enroll(student_id, user_id, student_name):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        try:
            finger.empty_library()
            # F1
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "PLACE_F1", "enrolling_student_name": student_name})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "REMOVE_F1"})
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "AGAIN_F1"})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(2)
            if finger.create_model() == adafruit_fingerprint.OK:
                with open(os.path.join(TEMPLATES_DIR, f"{student_id}_f1.dat"), "wb") as f:
                    f.write(bytearray(finger.get_fpdata("char", 1)))
            
            # F2
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "WAIT_F2"})
            time.sleep(2)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "PLACE_F2"})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "REMOVE_F2"})
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "AGAIN_F2"})
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(2)
            if finger.create_model() == adafruit_fingerprint.OK:
                with open(os.path.join(TEMPLATES_DIR, f"{student_id}_f2.dat"), "wb") as f:
                    f.write(bytearray(finger.get_fpdata("char", 1)))
            
            db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id).update({"fingerprintID": "HYBRID_DUAL"})
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "SUCCESS"})
        except:
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "ERROR"})
        time.sleep(3)
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "IDLE"})
        is_enrolling = False

def do_attendance_loop():
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
                            if student_id and cached_user_id:
                                today = datetime.now().strftime("%Y-%m-%d")
                                db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students").document(student_id).update({f"attendance.{today}": "present"})
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "success", "last_student_name": student_name})
                                time.sleep(3)
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
                        else:
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "mismatch"})
                            time.sleep(3)
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except: pass
        time.sleep(0.05)

def listen_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        global attendance_mode, cached_user_id
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                if data.get("status") == "pending":
                    cmd_type = data.get("type")
                    if cmd_type == "ENROLL":
                        s_id = data.get("studentId")
                        for f in glob.glob(os.path.join(TEMPLATES_DIR, f"{s_id}*")): os.remove(f)
                        threading.Thread(target=enroll, args=(s_id, data.get("userId"), data.get("studentName", "Student"))).start()
                    elif cmd_type == "START_ATTENDANCE":
                        attendance_mode, cached_user_id = True, data.get("userId")
                        sync_templates_to_sensor(data.get("className"), cached_user_id)
                    elif cmd_type == "END_ATTENDANCE":
                        attendance_mode = False
                        finger.empty_library()
                        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
                    elif cmd_type == "REBOOT": subprocess.Popen("sleep 2 && sudo reboot", shell=True)
                    elif cmd_type == "SHUTDOWN": subprocess.Popen("sleep 2 && sudo shutdown -h now", shell=True)
                    change.document.reference.update({"status": "done"})
    db.collection(COLLECTION_COMMANDS).where("deviceId", "==", DEVICE_SERIAL).where("status", "==", "pending").on_snapshot(on_snapshot)

if __name__ == "__main__":
    if setup_firebase():
        if setup_hardware():
            threading.Thread(target=listen_commands, daemon=True).start()
            threading.Thread(target=do_attendance_loop, daemon=True).start()
            while True: time.sleep(1)
