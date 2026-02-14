# **App Name**: Classmate Keeper

## Core Features:

- Simplified UI: Simple UI with 'Add Student', 'Start Attendance', and 'End Attendance' buttons.
- Student Storage: Stores student name, phone number, and fingerprint ID in Firebase.
- Attendance Recording: Marks students as present when their fingerprint is scanned via an external hardware device.
- Absence Detection: Identifies absent students by comparing current attendance to enrolled students using the fingerprint data as a tool.
- SMS Notifications: Sends SMS notifications to absent students via API (Twilio or Fast2SMS).

## Style Guidelines:

- Primary color: Forest green (#38A3A5) to evoke a sense of growth and stability, representing the learning environment.
- Background color: Light beige (#F5F5DC), a desaturated tint of the primary, provides a neutral and calming backdrop, allowing the green to stand out without being overwhelming.
- Accent color: Muted orange (#D98E5B) adds a touch of warmth and energy. Its low saturation ensures it complements the green rather than clashing, and calls attention to important elements.
- Body and headline font: 'PT Sans' (sans-serif) for a clean, modern, readable appearance suitable for all UI elements.
- Use clear, minimalistic icons to represent actions (add student, start attendance, etc.).
- A clean, organized layout with intuitive placement of buttons and information display.
- Subtle animations/transitions when marking attendance or sending notifications.