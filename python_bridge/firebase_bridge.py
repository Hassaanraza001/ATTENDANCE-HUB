
import firebase_admin
from firebase_admin import credentials, firestore
import time
import sys
import os
import threading
import serial
import random
import string
from datetime import datetime
import adafruit_fingerprint

# =============================================================
# CONFIG
# =============================================================

SERVICE_ACCOUNT_KEY_FILENAME = "serviceAccountKey.json"

COLLECTION_COMMANDS = "kiosk_commands"
COLLECTION_STUDENTS = "students"
COLLECTION_STATUS = "system_status"

TEMPLATES_DIR = "fingerprint_templates"

if not os.path.exists(TEMPLATES_DIR):
    os.makedirs(TEMPLATES_DIR)

HEARTBEAT_INTERVAL = 30

# =============================================================

db = None
finger = None
DEVICE_SERIAL = "UNKNOWN"
LINKED_USER_ID = None
PAIRING_TOKEN = None


# =============================================================
# GET SERIAL
# =============================================================

def get_serial():

    cpuserial = "0000000000000000"

    try:
        with open('/proc/cpuinfo','r') as f:
            for line in f:
                if line.startswith('Serial'):
                    cpuserial = line.split(":")[1].strip()
    except:
        cpuserial = "PI_" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

    return cpuserial


# =============================================================
# FIREBASE SETUP
# =============================================================

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
        sys.exit(1)


# =============================================================
# FINGERPRINT SETUP
# =============================================================

def setup_hardware():

    global finger

    print("Connecting fingerprint sensor...")

    try:

        uart = serial.Serial("/dev/serial0", 57600, timeout=1)

        finger = adafruit_fingerprint.Adafruit_Fingerprint(uart)

        if finger.verify_password():
            print("[2/2] Fingerprint sensor connected")
            return True
        else:
            print("Sensor password failed")
            return False

    except Exception as e:

        print("Sensor error:", e)

        return False


# =============================================================
# HEARTBEAT
# =============================================================

def update_system_health():

    global LINKED_USER_ID,PAIRING_TOKEN

    while True:

        try:

            doc_ref = db.collection(COLLECTION_STATUS).document(DEVICE_SERIAL)

            snap = doc_ref.get()

            if snap.exists:

                data = snap.to_dict()

                LINKED_USER_ID = data.get("userId")

                if not LINKED_USER_ID:
                    PAIRING_TOKEN = data.get("pairing_token")

            if not LINKED_USER_ID and not PAIRING_TOKEN:

                PAIRING_TOKEN = ''.join(random.choices(string.digits,k=6))

            doc_ref.set({

                "last_online":firestore.SERVER_TIMESTAMP,
                "status":"online",
                "deviceId":DEVICE_SERIAL,
                "templates_stored":len(os.listdir(TEMPLATES_DIR)),
                "pairing_token":PAIRING_TOKEN if not LINKED_USER_ID else None

            },merge=True)

            print("Heartbeat sent")

        except Exception as e:

            print("Heartbeat error:",e)

        time.sleep(HEARTBEAT_INTERVAL)


# =============================================================
# ENROLL
# =============================================================

def enroll_new_finger(student_id):

    try:

        print("Place finger")

        while finger.get_image()!=adafruit_fingerprint.OK:
            time.sleep(0.1)

        finger.image_2_tz(1)

        print("Remove finger")

        time.sleep(2)

        while finger.get_image()==adafruit_fingerprint.OK:
            time.sleep(0.1)

        print("Place again")

        while finger.get_image()!=adafruit_fingerprint.OK:
            time.sleep(0.1)

        finger.image_2_tz(2)

        if finger.create_model()==adafruit_fingerprint.OK:

            template = finger.get_fpdata(1)

            with open(os.path.join(TEMPLATES_DIR,f"{student_id}.dat"),"wb") as f:

                f.write(bytearray(template))

            db.collection(COLLECTION_STUDENTS).document(student_id).update({

                "fingerprintID":"ENROLLED",
                "last_enrolled":firestore.SERVER_TIMESTAMP
            })

            print("Enroll success")

            return True

    except Exception as e:

        print("Enroll error:",e)

    return False


# =============================================================
# VERIFY
# =============================================================

def verify_finger_locally():

    if finger.get_image()!=adafruit_fingerprint.OK:
        return None

    if finger.image_2_tz(1)!=adafruit_fingerprint.OK:
        return None

    for filename in os.listdir(TEMPLATES_DIR):

        if filename.endswith(".dat"):

            with open(os.path.join(TEMPLATES_DIR,filename),"rb") as f:

                stored_template=list(f.read())

            finger.send_fpdata(stored_template,2)

            if finger.compare_templates()>=50:

                return filename.replace(".dat","")

    return None


# =============================================================
# ATTENDANCE LOOP
# =============================================================

def handle_biometric_loop():

    while True:

        matched_id = verify_finger_locally()

        if matched_id:

            today = datetime.now().strftime("%Y-%m-%d")

            student_ref = db.collection(COLLECTION_STUDENTS).document(matched_id)

            student_doc = student_ref.get()

            if student_doc.exists:

                student_data = student_doc.to_dict()

                attendance = student_data.get("attendance",{})

                if attendance.get(today)!="present":

                    attendance[today]="present"

                    student_ref.update({"attendance":attendance})

                    print("Attendance:",student_data.get("name"))

                    time.sleep(5)

        time.sleep(0.5)


# =============================================================
# COMMAND LISTENER
# =============================================================

def listen_for_commands():

    def on_snapshot(col_snapshot,changes,read_time):

        for change in col_snapshot:

            data = change.to_dict()

            if data.get("status")=="pending":

                cmd_type=data.get("type")

                if cmd_type=="ENROLL":

                    success=enroll_new_finger(data.get("studentId"))

                    change.reference.update({"status":"completed" if success else "failed"})

                elif cmd_type=="REBOOT":

                    change.reference.update({"status":"completed"})
                    os.system("sudo reboot")

                elif cmd_type=="SHUTDOWN":

                    change.reference.update({"status":"completed"})
                    os.system("sudo shutdown -h now")

    query = db.collection(COLLECTION_COMMANDS)\
        .where("deviceId","==",DEVICE_SERIAL)\
        .where("status","==","pending")

    query.on_snapshot(on_snapshot)


# =============================================================
# MAIN
# =============================================================

if __name__=="__main__":

    DEVICE_SERIAL = get_serial()

    setup_firebase()

    setup_hardware()

    threading.Thread(target=update_system_health,daemon=True).start()

    threading.Thread(target=handle_biometric_loop,daemon=True).start()

    listen_for_commands()

    print("DEVICE READY:",DEVICE_SERIAL)

    while True:
        time.sleep(1)
