
# Project RAD Model: Attendance HUB System

This document outlines the Rapid Application Development (RAD) model followed for the "Attendance HUB System" project.

---

### **Phase 1: Requirements Planning (Yojana aur Zarooratein)**

**1. Project's Core Objective (Business Objective):**
To create a desktop-based software that simplifies and modernizes the attendance process for schools and colleges. The system's primary function is to take attendance using biometric (fingerprint) and manual methods, and to instantly notify parents and faculty via SMS.

**2. Key Features:**
*   **User Management:** Login/Signup facility for the school admin.
*   **Student Management:** Add new students, edit their information (name, class, phone number), and remove them from the system.
*   **Faculty Management:** Add, edit, and remove faculty members (like Principal, HOD).
*   **Biometric Integration:** Identify students using a fingerprint sensor (AS608).
    *   Enroll a unique fingerprint for each student.
    *   Mark a student as "Present" by scanning their fingerprint during attendance.
*   **Dual Attendance Mode:**
    *   **Biometric Mode:** Automated attendance via fingerprint scanning.
    *   **Manual Mode:** Facility for a teacher to manually mark "Present" or "Absent".
*   **SMS Notification System:**
    *   Upon attendance completion, send an SMS to parents about their child's "Present" or "Absent" status.
    *   Send a summary SMS of the class's attendance (e.g., "Class 10A: 25/30 students present") to all faculty members.
*   **Reporting:** Generate class-wise attendance reports by date range or by month.
*   **Hardware Auto-Detection:** Automatically establish a COM port connection with the Arduino device when the software starts.

**3. Technology Stack:**
*   **Frontend (UI):** Next.js (React Framework), ShadCN UI, TailwindCSS
*   **Desktop Application Framework:** Electron.js
*   **Database:** Cloud-based NoSQL Database (Firebase Firestore)
*   **Hardware Interface:** `serialport` npm package
*   **Microcontroller:** Arduino UNO
*   **Peripherals:** SIM800L GSM Module, AS608 Fingerprint Sensor

---

### **Phase 2: User Design (Prototype aur Feedback)**

In this phase, UI prototypes were rapidly created to finalize the look and feel of the system.

*   **Prototype 1 (Core Dashboard):**
    *   A basic dashboard was created using Next.js and ShadCN.
    *   A table to display the student list and a form to add new students were designed.
    *   **Feedback:** Users requested class-wise filtering and a search functionality.

*   **Prototype 2 (Attendance Workflow):**
    *   "Start" and "End" attendance buttons were added.
    *   The design for Present/Absent buttons inside the table for manual attendance was created.
    *   **Feedback:** The need for separate options for Biometric and Manual modes was identified.

*   **Prototype 3 (Final UI):**
    *   Based on feedback, the "Start Attendance" button was converted into a dropdown menu with "Biometric Session" and "Manual Session" options.
    *   Separate dialog windows for "Manage Faculty" and "View Reports" were designed.

---

### **Phase 3: Construction (Nirmaan)**

In this phase, the prototypes were converted into a functional application through iterative development sprints.

*   **Sprint 1: Backend & Database Setup**
    *   The basic structure of the Electron.js application was prepared.
    *   The schema for `students` and `faculties` collections in Firebase Firestore was designed.
    *   User authentication (Login/Signup) was integrated with Firebase Auth.

*   **Sprint 2: Hardware Integration**
    *   C++ code for Arduino was written to handle both the SIM800L (SMS) and AS608 (Fingerprint) modules simultaneously.
    *   Serial communication between Electron (`main.js`) and Arduino was established using custom commands like `STUDENT_SMS`, `FACULTY_SMS`, and `ENROLL_FINGER`.
    *   The automatic COM port detection feature was implemented.

*   **Sprint 3: Core Application Logic**
    *   The code to fetch data (students, faculties) from Firebase in the frontend (`page.tsx`) was written.
    *   The complete workflow for taking attendance (biometric/manual), saving the data, and sending SMS was built. This included data transfer between the frontend and Electron backend via the `window.api` bridge.

*   **Sprint 4: Final Features & Refinements**
    *   The feature to generate attendance reports was developed.
    *   The UI for fingerprint enrollment (dialogs and status messages) was created.
    *   Error handling and user feedback mechanisms (toast notifications) were improved throughout the application.

---

### **Phase 4: Cutover (Deployment aur Taiyaari)**

*   **Testing:** Every feature of the system was tested under various scenarios (e.g., Arduino disconnected, invalid phone number, etc.).
*   **Documentation:**
    *   `hardware_connections.md`: A hardware setup guide for the end-user was prepared.
    *   `README.md`: Instructions for running the project were written.
*   **Deployment:** A process to create an installable setup file (`.exe`) for Windows was established using `electron-builder`. This includes packaging the app icon and other necessary resources.
*   **User Training:** End-users were provided with information on how to use the software, enroll new students, and generate reports.
