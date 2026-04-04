
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
TEMPLATES_DIR = "templates"

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
        script_dir = os.path.dirname(os.path.abspath(__file__))
        key_path = os.path.join(script_dir, SERVICE_ACCOUNT_KEY_FILENAME)
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

# ================= HARDWARE SETUP =================
def setup_hardware():
    global finger, uart_port
    try:
        if uart_port:
            try: uart_port.close()
            except: pass
        
        print(f"Connecting to AS608 on /dev/serial0...")
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        time.sleep(3)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        
        if finger.read_templates() != adafruit_fingerprint.OK:
            print("Hardware Warning: Sensor handshake failed.")
            
        print(f"[2/2] Hardware Ready. DEVICE ID: {DEVICE_SERIAL}")
        return True
    except Exception as e:
        print("Sensor Hardware Error:", e)
        return False

# ================= UI STATUS =================
def update_ui_status(msg):
    try:
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
            "enrollment_status": msg
        }, merge=True)
    except:
        pass

# ================= HEARTBEAT =================
def heartbeat():
    while True:
        if is_enrolling or attendance_mode:
            time.sleep(5)
            continue
            
        try:
            with sensor_lock:
                # Count files in templates directory
                template_count = len(glob.glob(os.path.join(TEMPLATES_DIR, "*.dat")))

            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
                "deviceId": DEVICE_SERIAL,
                "status": "online",
                "last_online": firestore.SERVER_TIMESTAMP,
                "hardware_ready": True,
                "templates_stored": template_count
            }, merge=True)
            print(f"Heartbeat: {template_count} templates found in SD Card.")
        except Exception as e:
            print("Heartbeat failed:", e)
        time.sleep(HEARTBEAT_INTERVAL)

# ================= HYBRID ENROLL LOGIC =================
def enroll(student_id, user_id):
    global is_enrolling
    with sensor_lock:
        is_enrolling = True
        print(f"\n--- HYBRID ENROLLMENT INITIATED: {student_id} ---")
        
        try:
            update_ui_status("PLACE_FINGER")
            while finger.get_image() != adafruit_fingerprint.OK:
                time.sleep(0.1)
            finger.image_2_tz(1)

            update_ui_status("REMOVE_FINGER")
            time.sleep(2)
            while finger.get_image() != adafruit_fingerprint.NOFINGER:
                time.sleep(0.1)

            update_ui_status("PLACE_AGAIN")
            while finger.get_image() != adafruit_fingerprint.OK:
                time.sleep(0.1)
            finger.image_2_tz(2)

            if finger.create_model() == adafruit_fingerprint.OK:
                update_ui_status("SAVING_TO_PI")
                print("Downloading template from sensor...")
                
                # Download template (512 bytes) from sensor's temporary buffer
                data = finger.get_fpdata("char", 1)
                
                if data:
                    # Save to Pi's SD Card
                    file_path = os.path.join(TEMPLATES_DIR, f"{student_id}.dat")
                    with open(file_path, "wb") as f:
                        f.write(bytearray(data))
                    
                    # Update Firebase
                    student_ref = db.collection(COLLECTION_INSTITUTES).document(user_id).collection("students").document(student_id)
                    student_ref.update({
                        "fingerprintID": "HYBRID_STORAGE",
                        "updatedAt": firestore.SERVER_TIMESTAMP
                    })
                    
                    print(f"SUCCESS: Template saved to {file_path}")
                    update_ui_status("SUCCESS")
                else:
                    print("ERROR: Could not download template from sensor")
                    update_ui_status("HARDWARE_ERROR")
            else:
                print("ERROR: Fingers did not match")
                update_ui_status("MATCH_ERROR")

        except Exception as e:
            print("Enrollment Exception:", e)
            update_ui_status("ERROR_IMAGE")

        time.sleep(2)
        update_ui_status("IDLE")
        is_enrolling = False

# ================= HYBRID ATTENDANCE ENGINE =================
def do_attendance_loop():
    global attendance_mode
    print("Hybrid Attendance engine active...")
    
    while True:
        if not attendance_mode or is_enrolling:
            time.sleep(0.5)
            continue

        with sensor_lock:
            try:
                if finger.get_image() == adafruit_fingerprint.OK:
                    print("Finger detected! Starting software match...")
                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "searching"})
                    
                    if finger.image_2_tz(1) == adafruit_fingerprint.OK:
                        # Get all stored templates
                        template_files = glob.glob(os.path.join(TEMPLATES_DIR, "*.dat"))
                        
                        status_doc = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).get()
                        current_userId = status_doc.to_dict().get("userId") if status_doc.exists else None

                        if not current_userId:
                            print("Access Denied: Device not paired.")
                            continue

                        found_match = False
                        for file_path in template_files:
                            student_id = os.path.basename(file_path).replace(".dat", "")
                            
                            # Upload template to Buffer 2
                            with open(file_path, "rb") as f:
                                template_data = f.read()
                            
                            finger.send_fpdata(list(template_data), "char", 2)
                            
                            # Compare Buffer 1 and Buffer 2
                            if finger.compare_templates() >= 40: # Threshold 40
                                print(f"✅ MATCH FOUND! Student ID: {student_id}")
                                found_match = True
                                
                                # Mark attendance in Firestore
                                student_ref = db.collection(COLLECTION_INSTITUTES).document(current_userId).collection("students").document(student_id)
                                s_doc = student_ref.get()
                                
                                if s_doc.exists:
                                    student_data = s_doc.to_dict()
                                    student_name = student_data.get('name', 'Unknown')
                                    today = datetime.now().strftime("%Y-%m-%d")
                                    attendance_map = student_data.get("attendance", {})
                                    attendance_map[today] = "present"
                                    
                                    student_ref.update({
                                        "attendance": attendance_map,
                                        "last_attendance": firestore.SERVER_TIMESTAMP
                                    })
                                    
                                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                        "scan_status": "success",
                                        "last_student_name": student_name,
                                        "last_scan": firestore.SERVER_TIMESTAMP
                                    })
                                    time.sleep(4)
                                    break
                        
                        if not found_match:
                            print("No match found in local database.")
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
                        attendance_mode = True
                    elif cmd_type == "END_ATTENDANCE":
                        attendance_mode = False
                        update_ui_status("IDLE")
                    elif cmd_type == "DELETE_TEMPLATE":
                        student_id = data.get("studentId")
                        file_path = os.path.join(TEMPLATES_DIR, f"{student_id}.dat")
                        if os.path.exists(file_path):
                            os.remove(file_path)
                            print(f"DELETED: {file_path}")
                    elif cmd_type == "RESET_SENSOR":
                        with sensor_lock:
                            print("!!! WIPING LOCAL DATABASE !!!")
                            files = glob.glob(os.path.join(TEMPLATES_DIR, "*.dat"))
                            for f in files: os.remove(f)
                            finger.empty_library()
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                "templates_stored": 0,
                                "enrollment_status": "IDLE"
                            })
                            print(">>> DATABASE WIPED CLEAN")

                    change.document.reference.update({"status": "done"})

    db.collection(COLLECTION_COMMANDS).where("status", "==", "pending").on_snapshot(on_snapshot)

if __name__ == "__main__":
    print("\n--- Attendance HUB BioSync v11.0 (UNLIMITED HYBRID) ---")
    if setup_firebase():
        if setup_hardware():
            update_ui_status("IDLE")
            threading.Thread(target=heartbeat, daemon=True).start()
            threading.Thread(target=listen_commands, daemon=True).start()
            threading.Thread(target=do_attendance_loop, daemon=True).start()
            while True: time.sleep(1)
