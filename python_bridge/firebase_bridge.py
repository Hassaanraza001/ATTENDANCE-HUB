
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

HEARTBEAT_INTERVAL = 60 # Increased to save writes

db = None
finger = None
uart_port = None

is_enrolling = False
attendance_mode = False
sensor_lock = threading.Lock()

# Local Caching to prevent Firestore GETs during loops
slot_map = {} # slot_id -> student_id
name_map = {} # student_id -> student_name
cached_user_id = None

# Ensure templates directory exists
if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

# ================= DEVICE ID =================
def get_serial():
    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.split(":")[1].strip()
    except:
        pass
    return "10000000741245e8" 

DEVICE_SERIAL = get_serial()

# ================= FIREBASE SETUP =================
def setup_firebase():
    global db, cached_user_id
    try:
        key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
        if not os.path.exists(key_path):
            print(f"CRITICAL ERROR: {SERVICE_ACCOUNT_KEY_FILENAME} not found at {key_path}")
            return False
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        
        # Initial user pairing check (Done once at startup to save reads later)
        status_ref = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL)
        doc = status_ref.get()
        if doc.exists:
            cached_user_id = doc.to_dict().get("userId")
            
        print("[1/2] Firebase Connected & User ID Cached")
        return True
    except Exception as e:
        print("Firebase Setup Error:", e)
        return False

# ================= HARDWARE SETUP & SYNC =================
def setup_hardware():
    global finger, uart_port
    try:
        if uart_port:
            try: uart_port.close()
            except: pass
        
        print(f"Connecting to AS608 on /dev/serial0...")
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        time.sleep(2)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        print(f"[2/2] Hardware Ready. DEVICE ID: {DEVICE_SERIAL}")
        update_online_status()
        return True
    except Exception as e:
        print("Sensor Hardware Error:", e)
        return False

def sync_templates_to_sensor(target_class=None, user_id=None):
    """Wipes sensor memory and loads ONLY students of the target class into sensor slots"""
    global slot_map, name_map, cached_user_id
    print(f"\n--- SYNCING {target_class if target_class else 'ALL'} CLASS TEMPLATES TO SENSOR ---")
    
    if user_id: cached_user_id = user_id

    with sensor_lock:
        try:
            print("Wiping sensor internal library...")
            finger.empty_library() 
            slot_map = {}
            name_map = {} # Reset names to avoid stale data
            
            if cached_user_id and target_class:
                print(f"Fetching students for class: {target_class}")
                # One-time read for the entire class - very efficient
                students_ref = db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students")
                query = students_ref.where("className", "==", target_class)
                docs = query.get() 
                
                current_slot = 1
                for doc in docs:
                    s_id = doc.id
                    s_data = doc.to_dict()
                    s_name = s_data.get("name", "Unknown")
                    
                    # Look for template on Pi SD card
                    file_path = os.path.join(TEMPLATES_DIR, f"{s_id}.dat")
                    if os.path.exists(file_path):
                        with open(file_path, "rb") as f:
                            template_data = list(f.read()[:512])
                        
                        finger.send_fpdata(template_data, "char", 1)
                        time.sleep(0.02)
                        if finger.store_model(current_slot) == adafruit_fingerprint.OK:
                            slot_map[current_slot] = s_id
                            name_map[s_id] = s_name # CACHE NAME LOCALLY
                            current_slot += 1
                            if current_slot > 127: break
            
            print(f"Sync Complete: {len(slot_map)} students cached locally.\n")
            
            # Reset status to idle
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                "scan_status": "idle",
                "last_student_name": ""
            })
            
        except Exception as e:
            print("Sync Error:", e)

# ================= UI STATUS =================
def update_ui_status(msg, student_name=None):
    try:
        data = {"enrollment_status": msg}
        if student_name:
            data["enrolling_student_name"] = student_name
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set(data, merge=True)
    except: pass

def update_online_status():
    try:
        template_count = len(glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")))
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
            "deviceId": DEVICE_SERIAL,
            "status": "online",
            "last_online": firestore.SERVER_TIMESTAMP,
            "templates_stored": template_count
        }, merge=True)
    except: pass

# ================= HEARTBEAT =================
def heartbeat():
    while True:
        if not is_enrolling and not attendance_mode:
            update_online_status()
        time.sleep(HEARTBEAT_INTERVAL)

# ================= ENROLL LOGIC =================
def enroll(student_id, user_id, student_name):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        try:
            uart_port.reset_input_buffer()
            finger.empty_library()
            
            update_ui_status("REMOVE_FINGER", student_name)
            while finger.get_image() != adafruit_fingerprint.NOFINGER:
                time.sleep(0.1)
            
            update_ui_status("PLACE_FINGER", student_name)
            while finger.get_image() != adafruit_fingerprint.OK: 
                time.sleep(0.1)
            finger.image_2_tz(1)

            update_ui_status("REMOVE_FINGER", student_name)
            time.sleep(1)
            while finger.get_image() != adafruit_fingerprint.NOFINGER: 
                time.sleep(0.1)

            update_ui_status("PLACE_AGAIN", student_name)
            while finger.get_image() != adafruit_fingerprint.OK: 
                time.sleep(0.1)
            finger.image_2_tz(2)

            if finger.create_model() == adafruit_fingerprint.OK:
                update_ui_status("SAVING_TO_PI", student_name)
                data = finger.get_fpdata("char", 1)
                if data:
                    with open(os.path.join(TEMPLATES_DIR, f"{student_id}.dat"), "wb") as f:
                        f.write(bytearray(data))
                    
                    db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id).update({
                        "fingerprintID": "HYBRID_STORAGE", 
                        "updatedAt": firestore.SERVER_TIMESTAMP
                    })
                    update_ui_status("SUCCESS", student_name)
                else: update_ui_status("HARDWARE_ERROR", student_name)
            else: update_ui_status("MATCH_ERROR", student_name)
        except Exception as e:
            print("Enroll Error:", e)
            update_ui_status("ERROR_IMAGE", student_name)
        
        time.sleep(2)
        update_ui_status("IDLE")
        is_enrolling = False

# ================= ATTENDANCE LOOP =================
def do_attendance_loop():
    global attendance_mode, cached_user_id
    while True:
        if not attendance_mode or is_enrolling:
            time.sleep(0.5)
            continue

        with sensor_lock:
            try:
                # OPTIMIZED: No DB reads inside this loop unless a finger is matched
                if finger.get_image() == adafruit_fingerprint.OK:
                    if finger.image_2_tz(1) == adafruit_fingerprint.OK:
                        if finger.finger_search() == adafruit_fingerprint.OK:
                            matched_slot = finger.finger_id
                            student_id = slot_map.get(matched_slot)
                            student_name = name_map.get(student_id, "Unknown")
                            
                            if student_id and cached_user_id:
                                # ZERO-READ ATTENDANCE: We already have ID and Name in local memory
                                today = datetime.now().strftime("%Y-%m-%d")
                                student_ref = db.collection(COLLECTION_INSTITUTES).document(cached_user_id).collection("students").document(student_id)
                                
                                # WRITE 1: Student Attendance
                                student_ref.update({
                                    f"attendance.{today}": "present",
                                    "last_attendance": firestore.SERVER_TIMESTAMP
                                })
                                
                                # WRITE 2: Global UI Status
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                    "scan_status": "success",
                                    "last_student_name": student_name,
                                    "last_scan": firestore.SERVER_TIMESTAMP
                                })
                                print(f"Attendance marked: {student_name}")
                                time.sleep(4)
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except Exception as e:
                print("Loop Error:", e)
                time.sleep(1)
        time.sleep(0.1)

# ================= COMMAND LISTENER =================
def listen_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        global attendance_mode, cached_user_id
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                if data.get("status") == "pending":
                    cmd_type = data.get("type")
                    print(f"🔥 CMD: {cmd_type}")
                    change.document.reference.update({"status": "processing"})
                    
                    if cmd_type == "ENROLL":
                        threading.Thread(target=enroll, args=(data.get("studentId"), data.get("userId"), data.get("studentName", "New Student"))).start()
                    elif cmd_type == "START_ATTENDANCE":
                        attendance_mode = True
                        cached_user_id = data.get("userId")
                        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                            "scan_status": "idle",
                            "last_student_name": ""
                        })
                        sync_templates_to_sensor(data.get("className"), cached_user_id)
                    elif cmd_type == "END_ATTENDANCE":
                        attendance_mode = False
                        with sensor_lock: finger.empty_library()
                        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                            "scan_status": "idle",
                            "last_student_name": ""
                        })
                        update_ui_status("IDLE")
                    elif cmd_type == "RESET_SENSOR":
                        with sensor_lock:
                            for f in glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")): os.remove(f)
                            finger.empty_library()
                            slot_map.clear()
                            name_map.clear()
                            print("!!! SENSOR WIPED !!!")
                    
                    change.document.reference.update({"status": "done"})

    # CRITICAL: Filter by deviceId to avoid reading everyone's commands
    query = db.collection(COLLECTION_COMMANDS).where("deviceId", "==", DEVICE_SERIAL).where("status", "==", "pending")
    query.on_snapshot(on_snapshot)

if __name__ == "__main__":
    print("\n--- BioSync v13.2 (REMOTE-SYNC EDITION) ---")
    if setup_firebase():
        if setup_hardware():
            update_ui_status("IDLE")
            threading.Thread(target=heartbeat, daemon=True).start()
            threading.Thread(target=listen_commands, daemon=True).start()
            threading.Thread(target=do_attendance_loop, daemon=True).start()
            while True: time.sleep(1)
