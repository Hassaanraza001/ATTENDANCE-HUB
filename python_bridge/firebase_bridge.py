
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

HEARTBEAT_INTERVAL = 15 

db = None
finger = None
uart_port = None

is_enrolling = False
attendance_mode = False
sensor_lock = threading.Lock()

# Hardware matching yields a Slot ID (1-127), we map it to Student ID
slot_map = {}

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
    global db
    try:
        key_path = os.path.join(SCRIPT_DIR, SERVICE_ACCOUNT_KEY_FILENAME)
        if not os.path.exists(key_path):
            print(f"CRITICAL ERROR: {SERVICE_ACCOUNT_KEY_FILENAME} not found at {key_path}")
            return False
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[1/2] Firebase Connected Successfully")
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
        
        # User's working handshake logic (3s delay)
        time.sleep(3)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        
        if finger.read_templates() != adafruit_fingerprint.OK:
            print("Hardware Warning: Handshake check via read_templates failed, but continuing...")
            
        print(f"[2/2] Hardware Ready. DEVICE ID: {DEVICE_SERIAL}")
        
        # Initial status update
        update_online_status()
        return True
    except Exception as e:
        print("Sensor Hardware Error:", e)
        return False

def sync_templates_to_sensor(target_class=None, user_id=None):
    """Wipes sensor memory and loads ONLY students of the target class from Pi SD card into sensor slots"""
    global slot_map
    print(f"\n--- SYNCING {target_class if target_class else 'ALL'} CLASS TEMPLATES TO SENSOR ---")
    
    with sensor_lock:
        try:
            print("Wiping sensor internal library...")
            finger.empty_library() 
            slot_map = {}
            
            # 1. Determine which student IDs to load
            student_ids_to_load = []
            
            if target_class and user_id:
                print(f"Fetching students for class: {target_class}")
                q = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").where("className", "==", target_class)
                docs = q.get()
                student_ids_to_load = [doc.id for doc in docs]
                print(f"Found {len(student_ids_to_load)} students in class {target_class}.")
            else:
                # Fallback to loading all files if no class specified
                template_files = glob.glob(os.path.join(TEMPLATES_DIR, "*.dat"))
                student_ids_to_load = [os.path.basename(f).replace(".dat", "") for f in template_files]

            # 2. Load the templates into sensor slots
            current_slot = 1
            for student_id in student_ids_to_load:
                if current_slot > 127:
                    print("Warning: Sensor capacity reached (127 students).")
                    break
                
                file_path = os.path.join(TEMPLATES_DIR, f"{student_id}.dat")
                if not os.path.exists(file_path):
                    continue
                
                with open(file_path, "rb") as f:
                    template_data = list(f.read()[:512])
                
                # Upload template to Buffer 1 then save to a permanent Slot
                finger.send_fpdata(template_data, "char", 1)
                time.sleep(0.05) # Micro-delay for sensor to process
                
                if finger.store_model(current_slot) == adafruit_fingerprint.OK:
                    slot_map[current_slot] = student_id
                    print(f"Slot #{current_slot} loaded: {student_id}")
                    current_slot += 1
            
            print(f"Sync Complete: {len(slot_map)} students ready for instant matching.\n")
            
            # Update templates_stored status
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                "templates_stored": len(glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")))
            })
            
        except Exception as e:
            print("Sync Error:", e)

# ================= UI STATUS =================
def update_ui_status(msg):
    try:
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
            "enrollment_status": msg
        }, merge=True)
    except:
        pass

def update_online_status():
    try:
        template_count = len(glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")))
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
            "deviceId": DEVICE_SERIAL,
            "status": "online",
            "last_online": firestore.SERVER_TIMESTAMP,
            "hardware_ready": True,
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
def enroll(student_id, user_id):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        print(f"\n--- ENROLLING STUDENT: {student_id} ---")
        try:
            # WIPE SENSOR BEFORE ENROLLMENT
            print("Preparing sensor memory for enrollment...")
            finger.empty_library()
            
            update_ui_status("PLACE_FINGER")
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(1)

            update_ui_status("REMOVE_FINGER")
            time.sleep(2)
            while finger.get_image() != adafruit_fingerprint.NOFINGER: time.sleep(0.1)

            update_ui_status("PLACE_AGAIN")
            while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
            finger.image_2_tz(2)

            if finger.create_model() == adafruit_fingerprint.OK:
                update_ui_status("SAVING_TO_PI")
                
                # 1. Download template from sensor to Pi SD Card
                data = finger.get_fpdata("char", 1)
                if data:
                    file_path = os.path.join(TEMPLATES_DIR, f"{student_id}.dat")
                    with open(file_path, "wb") as f:
                        f.write(bytearray(data))
                    
                    # 2. Update Firebase
                    student_ref = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id)
                    student_ref.update({
                        "fingerprintID": "HYBRID_STORAGE", 
                        "updatedAt": firestore.SERVER_TIMESTAMP
                    })
                    
                    update_ui_status("SUCCESS")
                    print(f"Enrollment Success. Student saved to Pi SD Card.")
                else: update_ui_status("HARDWARE_ERROR")
            else: update_ui_status("MATCH_ERROR")
        except Exception as e:
            print("Enroll Error:", e)
            update_ui_status("ERROR_IMAGE")
        
        time.sleep(2)
        update_ui_status("IDLE")
        is_enrolling = False

# ================= FAST HARDWARE ATTENDANCE LOOP =================
def do_attendance_loop():
    global attendance_mode
    print("Fast Hardware-Search engine active...")
    while True:
        if not attendance_mode or is_enrolling:
            time.sleep(0.5)
            continue

        with sensor_lock:
            try:
                if finger.get_image() == adafruit_fingerprint.OK:
                    print("\n[SCANNED] Quick hardware matching...")
                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "searching"})
                    
                    if finger.image_2_tz(1) == adafruit_fingerprint.OK:
                        # Use Sensor's Internal Fast Search command
                        if finger.finger_search() == adafruit_fingerprint.OK:
                            matched_slot = finger.finger_id
                            student_id = slot_map.get(matched_slot)
                            
                            print(f"✅ HARDWARE MATCH! Slot: {matched_slot}, Confidence: {finger.confidence}")
                            
                            if student_id:
                                status_doc = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).get()
                                current_userId = status_doc.to_dict().get("userId")
                                
                                if current_userId:
                                    student_ref = db.collection(COLLECTION_INSTITUTES).document(current_userId).collection("students").document(student_id)
                                    
                                    today = datetime.now().strftime("%Y-%m-%d")
                                    
                                    # Atomic update for attendance
                                    student_ref.update({
                                        f"attendance.{today}": "present",
                                        "last_attendance": firestore.SERVER_TIMESTAMP
                                    })
                                    
                                    # Get student name for UI feedback
                                    s_doc = student_ref.get()
                                    student_name = s_doc.to_dict().get('name', 'Unknown') if s_doc.exists else 'Unknown'

                                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                        "scan_status": "success",
                                        "last_student_name": student_name,
                                        "last_scan": firestore.SERVER_TIMESTAMP
                                    })
                                    print(f"Attendance marked for: {student_name}")
                                    time.sleep(4)
                        else:
                            print("❌ No match found in hardware library for this class.")
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "no_match"})
                            time.sleep(2)
                        
                        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except Exception as e:
                print("Hardware loop error:", e)
                time.sleep(1)
                setup_hardware() 
        time.sleep(0.1)

# ================= COMMAND LISTENER =================
def listen_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        global attendance_mode
        for change in changes:
            if change.type.name == 'ADDED':
                data = change.document.to_dict()
                if data.get("deviceId") == DEVICE_SERIAL and data.get("status") == "pending":
                    cmd_type = data.get("type")
                    print(f"🔥 COMMAND RECEIVED: {cmd_type}")
                    change.document.reference.update({"status": "processing"})
                    
                    if cmd_type == "ENROLL":
                        threading.Thread(target=enroll, args=(data.get("studentId"), data.get("userId"))).start()
                    elif cmd_type == "START_ATTENDANCE":
                        # SYNC ONLY THE TARGET CLASS TEMPLATES FROM PI TO SENSOR
                        target_class = data.get("className")
                        user_id = data.get("userId")
                        sync_templates_to_sensor(target_class, user_id)
                        attendance_mode = True
                    elif cmd_type == "END_ATTENDANCE":
                        attendance_mode = False
                        # Wipe sensor on end to keep it clean for other classes/enrollment
                        with sensor_lock: finger.empty_library()
                        update_ui_status("IDLE")
                    elif cmd_type == "RESET_SENSOR":
                        with sensor_lock:
                            files = glob.glob(os.path.join(TEMPLATES_DIR, "*.dat"))
                            for f in files: os.remove(f)
                            finger.empty_library()
                            slot_map.clear()
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"templates_stored": 0})
                            print("!!! SYSTEM FACTORY RESET COMPLETE !!!")
                    
                    change.document.reference.update({"status": "done"})

    db.collection(COLLECTION_COMMANDS).where("status", "==", "pending").on_snapshot(on_snapshot)

if __name__ == "__main__":
    print("\n--- Attendance HUB BioSync v12.5 (CLASS-WISE SYNC) ---")
    if setup_firebase():
        if setup_hardware():
            update_ui_status("IDLE")
            threading.Thread(target=heartbeat, daemon=True).start()
            threading.Thread(target=listen_commands, daemon=True).start()
            threading.Thread(target=do_attendance_loop, daemon=True).start()
            while True: time.sleep(1)
