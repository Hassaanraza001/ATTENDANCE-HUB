
import firebase_admin
from firebase_admin import credentials, firestore
import time
import threading
import serial
import adafruit_fingerprint
from datetime import datetime
import os

# ================= CONFIG =================
SERVICE_ACCOUNT_KEY_FILENAME = "serviceAccountKey.json"

COLLECTION_COMMANDS = "kiosk_commands"
COLLECTION_STUDENTS = "students"
COLLECTION_STATUS = "system_status"

HEARTBEAT_INTERVAL = 30

db = None
finger = None
uart_port = None

is_enrolling = False
attendance_mode = False
sensor_lock = threading.Lock()

# ================= DEVICE ID =================
def get_serial():
    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'):
                    return line.split(":")[1].strip()
    except:
        pass
    return "PI_DEVICE_1"

DEVICE_SERIAL = get_serial()

# ================= FIREBASE SETUP =================
def setup_firebase():
    global db
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        key_path = os.path.join(script_dir, SERVICE_ACCOUNT_KEY_FILENAME)
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[1/2] Firebase Connected")
    except Exception as e:
        print("Firebase Error:", e)

# ================= HARDWARE SETUP =================
def setup_hardware():
    global finger, uart_port
    try:
        print("Connecting to sensor on /dev/serial0...")
        uart_port = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)
        # CRITICAL: Allow sensor to power up (First run fix)
        time.sleep(3)
        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart_port)
        
        if finger.read_templates() != adafruit_fingerprint.OK:
            print("Warning: Failed to read templates (Empty library?)")
            
        print(f"[2/2] Fingerprint sensor connected. DEVICE ID: {DEVICE_SERIAL}")
        return True
    except Exception as e:
        print("Sensor Hardware Error:", e)
        return False

# ================= STATUS UPDATES =================
def update_status(msg):
    try:
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
            "enrollment_status": msg
        }, merge=True)
    except:
        pass

# ================= HEARTBEAT =================
def heartbeat():
    while True:
        try:
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).set({
                "deviceId": DEVICE_SERIAL,
                "status": "online",
                "last_online": firestore.SERVER_TIMESTAMP,
                "hardware_ready": True
            }, merge=True)
            print("Heartbeat sent")
        except:
            pass
        time.sleep(HEARTBEAT_INTERVAL)

# ================= ROBUST IMAGE CAPTURE =================
def safe_get_image():
    """Retries capturing image multiple times for stability"""
    for _ in range(20):
        try:
            uart_port.reset_input_buffer()
            if finger.get_image() == adafruit_fingerprint.OK:
                return True
        except:
            pass
        time.sleep(0.2)
    return False

# ================= ENROLL LOGIC =================
def get_free_location():
    for i in range(1, 128):
        if finger.load_model(i) != adafruit_fingerprint.OK:
            return i
    return None

def enroll(student_id):
    global is_enrolling, attendance_mode
    with sensor_lock:
        is_enrolling = True
        attendance_mode = False 
        print(f"--- Starting Enrollment for: {student_id} ---")
        
        # Reset sensor memory for fresh enrollment if needed (Optional)
        # finger.empty_library() 
        
        update_status("PLACE_FINGER")

        try:
            # Capture 1
            if not safe_get_image():
                update_status("ERROR_IMAGE")
                is_enrolling = False
                return
            
            finger.image_2_tz(1)

            update_status("REMOVE_FINGER")
            time.sleep(2)
            while finger.get_image() != adafruit_fingerprint.NOFINGER:
                time.sleep(0.1)

            update_status("PLACE_AGAIN")
            if not safe_get_image():
                update_status("ERROR_IMAGE")
                is_enrolling = False
                return
                
            finger.image_2_tz(2)

            if finger.create_model() == adafruit_fingerprint.OK:
                location = get_free_location()
                if location and finger.store_model(location) == adafruit_fingerprint.OK:
                    print(f"SUCCESS: Stored in slot {location}")
                    db.collection(COLLECTION_STUDENTS).document(student_id).update({
                        "fingerprintID": str(location),
                        "updatedAt": firestore.SERVER_TIMESTAMP
                    })
                    update_status("SUCCESS")
                else:
                    update_status("HARDWARE_ERROR")
            else:
                update_status("MATCH_ERROR")

        except Exception as e:
            print("Enroll critical error:", e)
            update_status("ERROR")

        time.sleep(2)
        update_status("IDLE")
        is_enrolling = False

# ================= ATTENDANCE LOOP =================
def do_attendance():
    global attendance_mode
    print(">>> ATTENDANCE MODE ACTIVE <<<")
    update_status("SCAN_FINGER")

    while attendance_mode:
        if is_enrolling:
            time.sleep(1)
            continue

        with sensor_lock:
            try:
                # Use robust scanning
                if finger.get_image() == adafruit_fingerprint.OK:
                    print("Finger detected! Matching...")
                    
                    if finger.image_2_tz(1) == adafruit_fingerprint.OK:
                        uart_port.reset_input_buffer() # Flush before search
                        if finger.finger_search() == adafruit_fingerprint.OK:
                            matched_slot = str(finger.finger_id)
                            confidence = finger.confidence
                            print(f"Match Found! Slot: {matched_slot} (Conf: {confidence})")

                            # Fast query student by fingerprintID
                            students = db.collection(COLLECTION_STUDENTS).where("fingerprintID", "==", matched_slot).limit(1).get()

                            if len(students) > 0:
                                student_doc = students[0]
                                student_data = student_doc.to_dict()
                                student_name = student_data.get('name', 'Unknown')
                                
                                today = datetime.now().strftime("%Y-%m-%d")
                                attendance_map = student_data.get("attendance", {})
                                
                                # Mark attendance if not already marked today
                                if attendance_map.get(today) != "present":
                                    attendance_map[today] = "present"
                                    student_doc.reference.update({
                                        "attendance": attendance_map,
                                        "last_attendance": firestore.SERVER_TIMESTAMP
                                    })
                                    print(f"✅ Attendance marked: {student_name}")

                                # Update UI System Status for Success Screen
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({
                                    "scan_status": "success",
                                    "last_student_name": student_name,
                                    "last_scan": firestore.SERVER_TIMESTAMP
                                })
                                
                                time.sleep(4) # Success pause
                                db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
                            else:
                                print(f"Slot {matched_slot} not linked to any student.")
                        else:
                            print("❌ No match found in sensor database.")
                            # Optional: Update UI to show 'Try Again'
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "no_match"})
                            time.sleep(1)
                            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"scan_status": "idle"})
            except Exception as e:
                print("Loop error:", e)
        
        time.sleep(0.3)

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
                        threading.Thread(target=enroll, args=(data.get("studentId"),)).start()
                    
                    elif cmd_type == "START_ATTENDANCE":
                        if not attendance_mode:
                            attendance_mode = True
                            threading.Thread(target=do_attendance).start()
                    
                    elif cmd_type == "END_ATTENDANCE":
                        attendance_mode = False
                        update_status("IDLE")

                    change.document.reference.update({"status": "done"})

    print(f"Listening for commands for device: {DEVICE_SERIAL}...")
    query_watch = db.collection(COLLECTION_COMMANDS).where("status", "==", "pending")
    query_watch.on_snapshot(on_snapshot)

if __name__ == "__main__":
    print("\n--- Attendance HUB BioSync Bridge v2.8 ---")
    setup_firebase()
    if setup_hardware():
        update_status("IDLE")
        threading.Thread(target=heartbeat, daemon=True).start()
        listen_commands()
        
        # Keep main thread alive
        while True:
            time.sleep(1)
    else:
        print("CRITICAL: Hardware initialization failed.")
