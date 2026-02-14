
"use client";

import * as React from "react";
import { useState, useEffect, memo, useCallback } from "react";
import { format } from "date-fns";
import { 
  Fingerprint, 
  CheckCircle2, 
  UserPlus, 
  ArrowLeft,
  ChevronRight,
  Loader2,
  Cpu,
  XCircle,
  Link as LinkIcon,
  Zap,
  AlertTriangle,
  Info,
  ArrowUp,
  Space,
  Delete,
  ShieldCheck,
  Thermometer,
  QrCode
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/types";
import { getDb } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { 
  collection, 
  doc, 
  serverTimestamp, 
  addDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  limit,
  setDoc
} from "firebase/firestore";

// --- Booting Animation ---
const BootingScreen = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 1.5));
    }, 60);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[200]">
      <div className="relative mb-12 animate-bounce">
        <Cpu className="h-48 w-48 text-primary" />
      </div>
      <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase">Attendance HUB <span className="text-primary ml-1">v5</span></h1>
      <div className="mt-16 w-80 space-y-4">
        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
          <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-center font-mono text-primary text-xs uppercase tracking-widest">Initializing Secure Kernel...</p>
      </div>
    </div>
  );
};

const Clock = memo(() => {
  const [time, setTime] = useState<string>("--:--:--");
  useEffect(() => {
    const timer = setInterval(() => setTime(format(new Date(), "HH:mm:ss")), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="font-mono text-3xl font-bold text-white bg-white/10 backdrop-blur-md px-8 py-3 rounded-2xl border border-white/20">
      {time}
    </div>
  );
});

type KioskView = "pairing" | "home" | "attendance" | "registration" | "enrollment-step" | "success" | "processing";

export default function KioskPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [view, setView] = useState<KioskView>("processing");
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [lastStudent, setLastStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const [regName, setRegName] = useState("");
  const [regClass, setRegClass] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRollNo, setRegRollNo] = useState("");

  useEffect(() => {
    setTimeout(() => setIsBooting(false), 6000);
  }, []);

  // Professional Auto-Link Detection
  useEffect(() => {
    const db = getDb();
    
    let serial = localStorage.getItem("pi_serial_mock");
    if (!serial) {
        serial = "SIM_" + Math.random().toString(36).substr(2, 9).toUpperCase();
        localStorage.setItem("pi_serial_mock", serial);
    }
    setCurrentDeviceId(serial);

    const statusRef = doc(db, "system_status", serial);

    const unsubStatus = onSnapshot(statusRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemStatus(data);
        setCurrentUserId(data.userId);
        setPairingToken(data.pairing_token);
        
        if (data.userId) {
          setView(v => (v === "pairing" || v === "processing" ? "home" : v));
        } else {
          setView("pairing");
        }
      } else {
        // If it's a mock device and doesn't exist, we initialize it to get a code
        if (serial.startsWith("SIM_")) {
          const newToken = Math.floor(100000 + Math.random() * 900000).toString();
          setDoc(statusRef, {
            deviceId: serial,
            pairing_token: newToken,
            status: "online",
            last_online: serverTimestamp(),
            hardware_ready: false,
            cpu_temp: 42,
            templates_stored: 0
          });
        }
        setView("pairing");
      }
    });

    return () => unsubStatus();
  }, []);

  // Attendance Listener
  useEffect(() => {
    if (view === "attendance" && currentUserId) {
        const db = getDb();
        const today = format(new Date(), "yyyy-MM-dd");
        const q = query(collection(db, "students"), where("userId", "==", currentUserId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "modified") {
                    const studentData = { id: change.doc.id, ...change.doc.data() } as Student;
                    if (studentData.attendance?.[today] === "present") {
                        setLastStudent(studentData);
                        setView("success");
                        setTimeout(() => setView("home"), 4000);
                    }
                }
            });
        });
        return () => unsubscribe();
    }
  }, [view, currentUserId]);

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !currentDeviceId) return;
    try {
      const db = getDb();
      const docRef = await addDoc(collection(db, "students"), {
        name: regName, rollNo: Number(regRollNo), className: regClass, phone: `+91${regPhone}`,
        fingerprintID: "NOT_ENROLLED", attendance: {}, userId: currentUserId, createdAt: serverTimestamp()
      });
      await addDoc(collection(db, "kiosk_commands"), {
        type: "ENROLL", studentId: docRef.id, studentName: regName, deviceId: currentDeviceId, status: "pending", createdAt: serverTimestamp()
      });
      setView("enrollment-step");
    } catch (e) { toast({ variant: "destructive", title: "Registration Failed" }); }
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col items-center justify-center p-6 bg-slate-950 transition-all duration-700", view === "success" && "bg-emerald-600")}>
      
      {/* Diagnostic Bar */}
      {currentDeviceId && (
        <div className={cn("fixed top-0 left-0 right-0 h-10 flex items-center justify-center gap-4 px-4 z-50", systemStatus?.hardware_ready ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400")}>
          <Zap className="h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{systemStatus?.hardware_ready ? "Hardware Link Active" : "Sensor Error"}</span>
          <span className="text-[10px] font-bold">{currentDeviceId}</span>
        </div>
      )}

      <div className="absolute top-12 left-8 right-8 flex justify-between items-center z-10">
        <div className="bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-4">
            <Cpu className="h-7 w-7 text-emerald-400" />
            <span className="font-black text-2xl tracking-tighter text-white uppercase italic">Attendance HUB <span className="text-emerald-400 ml-1">v5</span></span>
        </div>
        <Clock />
      </div>

      <div className="w-full max-w-5xl z-10">
        {view === "pairing" && (
          <div className="max-w-lg w-full mx-auto animate-in fade-in zoom-in duration-500">
            <Card className="bg-white/5 backdrop-blur-3xl border-white/10 text-white rounded-[3rem] p-12 text-center space-y-8 border-2 shadow-2xl">
              <div className="p-10 bg-primary/20 rounded-full inline-block animate-pulse"><LinkIcon className="h-20 w-20 text-primary" /></div>
              <div className="space-y-4">
                <h2 className="text-5xl font-black uppercase italic tracking-tighter">Pairing Code</h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Enter this code in your Laptop Dashboard</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-3xl py-12">
                <span className="text-7xl font-black text-primary tracking-[0.3em] font-mono">{pairingToken || "------"}</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-white/20">
                <QrCode className="h-5 w-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Awaiting Remote Link...</span>
              </div>
            </Card>
          </div>
        )}

        {view === "home" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-20 duration-1000">
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/15 hover:scale-[1.02] cursor-pointer transition-all duration-500 rounded-[3rem] p-16 flex flex-col items-center space-y-8" onClick={() => setView("attendance")}>
                <div className="p-10 bg-primary/20 rounded-full"><Fingerprint className="h-24 w-24 text-primary" /></div>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">Mark Attendance</h2>
            </Card>
            <Card className="bg-white/5 backdrop-blur-xl border-white/10 hover:bg-white/15 hover:scale-[1.02] cursor-pointer transition-all duration-500 rounded-[3rem] p-16 flex flex-col items-center space-y-8" onClick={() => setView("registration")}>
                <div className="p-10 bg-emerald-500/20 rounded-full"><UserPlus className="h-24 w-24 text-emerald-400" /></div>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">New Student</h2>
            </Card>
          </div>
        )}

        {view === "attendance" && (
          <div className="flex flex-col items-center space-y-12 text-center animate-in zoom-in-95 duration-700">
             <Button variant="ghost" className="bg-white/5 text-white text-xl h-16 px-8 rounded-2xl border border-white/10" onClick={() => setView("home")}><ArrowLeft className="mr-3 h-8 w-8" /> GO BACK</Button>
            <div className="bg-white/5 p-24 rounded-full border-4 border-white/10 shadow-2xl animate-bounce"><Fingerprint className="h-48 w-48 text-white" /></div>
            <h1 className="text-7xl font-black text-white italic tracking-tighter uppercase">Place Finger</h1>
          </div>
        )}

        {view === "registration" && (
           <Card className="bg-slate-900/50 backdrop-blur-3xl border-white/10 text-white rounded-[3rem] p-12 border-2">
              <h2 className="text-5xl font-black italic tracking-tighter uppercase text-center mb-10">New Registration</h2>
              <form onSubmit={handleRegistration} className="grid grid-cols-2 gap-8">
                <Input className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" placeholder="Name" value={regName} onChange={e => setRegName(e.target.value)} required />
                <Input className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" placeholder="Roll No" value={regRollNo} onChange={e => setRegRollNo(e.target.value)} required />
                <Input className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" placeholder="Class" value={regClass} onChange={e => setRegClass(e.target.value)} required />
                <Input className="bg-white/5 border-white/10 h-16 text-xl rounded-2xl px-6" placeholder="Parent Mobile" value={regPhone} onChange={e => setRegPhone(e.target.value)} required />
                <Button type="submit" className="col-span-2 h-20 text-3xl font-black bg-emerald-600 rounded-2xl mt-4">SAVE & START ENROLL</Button>
                <Button variant="ghost" className="col-span-2 text-white/40" onClick={() => setView("home")}>CANCEL</Button>
              </form>
           </Card>
        )}

        {view === "enrollment-step" && (
            <div className="flex flex-col items-center space-y-12 animate-in zoom-in-95 duration-700">
                <div className="relative bg-white/5 p-24 rounded-full border-2 border-emerald-500/30">
                  <Fingerprint className="h-48 w-48 text-emerald-400 animate-pulse" />
                </div>
                <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase">{regName}</h1>
                <p className="text-3xl text-emerald-400 font-bold uppercase tracking-widest">{systemStatus?.enrollment_status || "Waiting for sensor..."}</p>
                <Button variant="ghost" className="bg-white/5 text-white text-xl h-16 px-8 rounded-2xl" onClick={() => setView("home")}>CANCEL</Button>
            </div>
        )}

        {view === "success" && (
          <div className="text-center space-y-10 animate-in zoom-in-95">
            <CheckCircle2 className="h-64 w-64 text-white mx-auto drop-shadow-2xl" />
            <h2 className="text-8xl font-black text-white italic tracking-tighter uppercase">SUCCESS!</h2>
            <p className="text-white/90 text-4xl font-bold uppercase tracking-widest">{lastStudent?.name}</p>
          </div>
        )}

        {view === "processing" && <Loader2 className="h-32 w-32 text-white animate-spin mx-auto opacity-20" />}
      </div>
    </div>
  );
}
