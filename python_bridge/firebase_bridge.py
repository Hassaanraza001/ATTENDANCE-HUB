
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import time
import sys
import os
import threading
import serial
import random
import string
from datetime import datetime

# =============================================================
# == CONFIGURATION ==
# =============================================================
SERVICE_ACCOUNT_KEY_FILENAME = "serviceAccountKey.json"

COLLECTION_COMMANDS = "kiosk_commands"
COLLECTION_STUDENTS = "students"
COLLECTION_STATUS = "system_status"

# Local folder for 20,000+ templates
TEMPLATES_DIR = "fingerprint_templates"
if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

# Optimization Thresholds
HEARTBEAT_INTERVAL = 30  # Increased to 30s to save writes
TEMP_THRESHOLD = 0.5     # Only update cloud if temp changes by 0.5 degrees
# =============================================================

db = None
finger = None
DEVICE_SERIAL = "UNKNOWN"
LINKED_USER_ID = None
PAIRING_TOKEN = None
last_reported_temp = 0.0

def get_serial():
    """Extract Raspberry Pi serial number."""
    cpuserial = "0000000000000000"
    try:
        f = open('/proc/cpuinfo', 'r')
        for line in f:
            if line[0:6] == 'Serial':
                cpuserial = line[10:26]
        f.close()
    except:
        cpuserial = "DEV_PI_" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return cpuserial

def setup_firebase():
    global db
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        key_path = os.path.join(script_dir, SERVICE_ACCOUNT_KEY_FILENAME)
        if not os.path.exists(key_path):
            print(f"ERROR: Key file {SERVICE_ACCOUNT_KEY_FILENAME} not found!")
            sys.exit(1)
            
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print(f"--- [1/2] Cloud Database Connected (Serial: {DEVICE_SERIAL}) ---")
    except Exception as e:
        print(f"ERROR: Firebase initialization failed: {e}")
        sys.exit(1)

def setup_hardware():
    global finger
    try:
        import adafruit_fingerprint
        ports = ["/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/serial0", "/dev/ttyS0"]
        for port_path in ports:
            if not os.path.exists(port_path): continue
            try:
                for baud in [57600, 9600]:
                    uart = serial.Serial(port_path, baudrate=baud, timeout=1)
                    finger = adafruit_fingerprint.Adafruit_Fingerprint(uart)
                    if finger.verify_password():
                        print(f"--- [2/2] Sensor Detected on {port_path} ---")
                        return True
            except: continue
        return False
    except ImportError:
        print("ERROR: adafruit_fingerprint missing.")
        return False

def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            return int(f.read()) / 1000.0
    except: return 0.0

def update_system_health():
    global LINKED_USER_ID, PAIRING_TOKEN, last_reported_temp
    while True:
        try:
            if db:
                current_temp = get_cpu_temp()
                
                # Check current registration status
                doc_ref = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL)
                snap = doc_ref.get()
                
                if snap.exists():
                    data = snap.to_dict()
                    LINKED_USER_ID = data.get("userId")
                    PAIRING_TOKEN = data.get("pairing_token")
                
                # If no pairing token exists and not linked, generate one
                if not LINKED_USER_ID and not PAIRING_TOKEN:
                    PAIRING_TOKEN = ''.join(random.choices(string.digits, k=6))
                
                health_data = {
                    "last_online": firestore.SERVER_TIMESTAMP,
                    "status": "online",
                    "hardware_ready": finger is not None,
                    "templates_stored": len(os.listdir(TEMPLATES_DIR)),
                    "deviceId": DEVICE_SERIAL,
                    "pairing_token": PAIRING_TOKEN if not LINKED_USER_ID else None
                }
                
                # Only send CPU temp if it changed significantly to save bandwidth/writes
                if abs(current_temp - last_reported_temp) >= TEMP_THRESHOLD:
                    health_data["cpu_temp"] = current_temp
                    last_reported_temp = current_temp
                
                doc_ref.set(health_data, merge=True)
                
                status_msg = f"Heartbeat Sent (Paired: {LINKED_USER_ID})" if LINKED_USER_ID else f"Heartbeat Sent (Unpaired - Token: {PAIRING_TOKEN})"
                print(status_msg)
                    
        except Exception as e:
            print(f"Health check failed: {e}")
        time.sleep(HEARTBEAT_INTERVAL)

def enroll_new_finger(student_id):
    if not finger or not LINKED_USER_ID: return False
    try:
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "Place finger on sensor..."})
        while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
        finger.image_2_tz(1)
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "Remove finger..."})
        time.sleep(2)
        while finger.get_image() == adafruit_fingerprint.OK: time.sleep(0.1)
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "Place same finger again..."})
        while finger.get_image() != adafruit_fingerprint.OK: time.sleep(0.1)
        finger.image_2_tz(2)
        
        if finger.create_model() == adafruit_fingerprint.OK:
            template = finger.get_fpdata(1) 
            with open(os.path.join(TEMPLATES_DIR, f"{student_id}.dat"), "wb") as f:
                f.write(bytearray(template))
            db.collection(COLLECTION_STUDENTS).document(student_id).update({
                "fingerprintID": "ENROLLED_ON_PI",
                "last_enrolled": firestore.SERVER_TIMESTAMP
            })
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "Enrollment Successful!"})
            return True
        else:
            db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": "Fail: Fingers did not match."})
    except Exception as e:
        db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"enrollment_status": f"Error: {e}"})
    return False

def verify_finger_locally():
    if not finger or finger.get_image() != adafruit_fingerprint.OK: return None
    if finger.image_2_tz(1) != adafruit_fingerprint.OK: return None
    for filename in os.listdir(TEMPLATES_DIR):
        if filename.endswith(".dat"):
            with open(os.path.join(TEMPLATES_DIR, filename), "rb") as f:
                stored_template = list(f.read())
            finger.send_fpdata(stored_template, 2)
            if finger.compare_templates() >= 50:
                return filename.replace(".dat", "")
    return None

def handle_biometric_loop():
    while True:
        if finger and LINKED_USER_ID:
            try:
                matched_id = verify_finger_locally()
                if matched_id:
                    today = datetime.now().strftime("%Y-%m-%d")
                    student_ref = db.collection(COLLECTION_STUDENTS).document(matched_id)
                    student_doc = student_ref.get()
                    if student_doc.exists:
                        student_data = student_doc.to_dict()
                        attendance = student_data.get("attendance", {})
                        if attendance.get(today) != "present":
                            attendance[today] = "present"
                            student_ref.update({"attendance": attendance})
                            print(f"Attendance Marked: {student_data.get('name')}")
                            time.sleep(5)
            except Exception as e:
                print(f"Biometric loop error: {e}")
        time.sleep(0.5)

def listen_for_commands():
    def on_snapshot(col_snapshot, changes, read_time):
        for change in col_snapshot:
            data = change.to_dict()
            if data.get("status") == "pending":
                cmd_type = data.get("type")
                if cmd_type == "ENROLL":
                    success = enroll_new_finger(data.get("studentId"))
                    change.reference.update({"status": "completed" if success else "failed"})
                elif cmd_type == "REBOOT":
                    change.reference.update({"status": "completed"})
                    print("Rebooting in 3s...")
                    time.sleep(3)
                    os.system("sudo reboot")
                elif cmd_type == "SHUTDOWN":
                    change.reference.update({"status": "completed"})
                    print("Shutdown in 3s...")
                    time.sleep(3)
                    os.system("sudo shutdown -h now")
                elif cmd_type == "RESET_PAIRING":
                    db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL).update({"userId": None, "pairing_token": None})
                    change.reference.update({"status": "completed"})

    # Listen only for commands directed to this device
    query = db.collection(COLLECTION_COMMANDS).where(filter=FieldFilter("deviceId", "==", DEVICE_SERIAL)).where(filter=FieldFilter("status", "==", "pending"))
    query.on_snapshot(on_snapshot)

if __name__ == "__main__":
    DEVICE_SERIAL = get_serial()
    setup_firebase()
    setup_hardware()
    threading.Thread(target=update_system_health, daemon=True).start()
    threading.Thread(target=handle_biometric_loop, daemon=True).start()
    listen_for_commands()
    print(f"--- UNLIMITED STANDALONE BOX ACTIVE (SERIAL: {DEVICE_SERIAL}) ---")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down...")
