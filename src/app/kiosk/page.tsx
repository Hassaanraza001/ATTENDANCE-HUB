
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Fingerprint, 
  CheckCircle2, 
  UserPlus, 
  Loader2,
  CalendarCheck,
  Cpu,
  XCircle,
  ChevronDown,
  Activity,
  Users,
  Database,
  ChevronLeft,
  Clock as ClockIcon,
  ShieldCheck,
  Zap
} from "lucide-react";
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
  setDoc,
  getCountFromServer
} from "firebase/firestore";

const KEYBOARD_LAYOUT = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["CapsLock", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
  ["Space"]
];

const NUMPAD_LAYOUT = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["0", "Backspace"]
];

const BootingScreen = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 1));
    }, 25);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[200]">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/30 blur-[80px] rounded-full animate-pulse" />
        <div className="relative p-8 bg-slate-900/50 rounded-full border border-primary/20 shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)]">
            <CalendarCheck className="h-20 w-20 text-primary animate-bounce" />
        </div>
      </div>
      <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2 text-glow-white">
        BioSync <span className="text-primary">Box</span>
      </h1>
      <p className="text-primary/60 font-mono text-[10px] tracking-[0.8em] uppercase font-bold mb-6">OS Kernel v2.8.5.PRO</p>
      <div className="w-64 space-y-3">
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
          <div className="h-full bg-primary shadow-[0_0_15px_rgba(59,130,246,1)] transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <style jsx>{`
        .text-glow-white { text-shadow: 0 0 30px rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
};

export default function KioskPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [view, setView] = useState<"pairing" | "home" | "attendance" | "registration" | "enrollment-step" | "success" | "processing">("processing");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [lastStudent, setLastStudent] = useState<Student | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [isCaps, setIsCaps] = useState(true);
  const { toast } = useToast();

  const [regData, setRegData] = useState({ name: "", rollNo: "", class: "", phone: "" });
  const [activeInput, setActiveInput] = useState<keyof typeof regData | null>(null);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const bootTimer = setTimeout(() => setIsBooting(false), 3500);
    return () => { clearInterval(clockTimer); clearTimeout(bootTimer); };
  }, []);

  useEffect(() => {
    const db = getDb();
    let serial = typeof window !== 'undefined' ? localStorage.getItem("pi_serial_mock") : null;
    if (!serial) {
        serial = "BS_" + Math.random().toString(36).substr(2, 9).toUpperCase();
        if (typeof window !== 'undefined') localStorage.setItem("pi_serial_mock", serial);
    }
    setCurrentDeviceId(serial);

    const statusRef = doc(db, "system_status", serial);
    return onSnapshot(statusRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemStatus(data);
        setCurrentUserId(data.userId);
        
        if (data.userId) {
          setView(v => (v === "pairing" || v === "processing" ? "home" : v));
          const qCount = query(collection(db, "students"), where("userId", "==", data.userId));
          const countSnap = await getCountFromServer(qCount);
          setStudentCount(countSnap.data().count);
        } else {
          setView("pairing");
        }
      } else if (serial && serial.startsWith("BS_")) {
        setDoc(statusRef, { 
            deviceId: serial, 
            pairing_token: Math.floor(100000 + Math.random() * 900000).toString(), 
            status: "online", 
            last_online: serverTimestamp(), 
            hardware_ready: true, 
            cpu_temp: 42.5, 
            templates_stored: 0 
        });
      }
    });
  }, []);

  useEffect(() => {
    if (view === "attendance" && currentUserId) {
        const db = getDb();
        const today = format(new Date(), "yyyy-MM-dd");
        const q = query(collection(db, "students"), where("userId", "==", currentUserId));
        return onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "modified") {
                    const studentData = { id: change.doc.id, ...change.doc.data() } as Student;
                    if (studentData.attendance?.[today] === "present") {
                        setLastStudent(studentData);
                        setView("success");
                        setTimeout(() => setView("home"), 3000);
                    }
                }
            });
        });
    }
  }, [view, currentUserId]);

  const onKeyPress = (key: string) => {
    if (key === "CapsLock") {
      setIsCaps(!isCaps);
      return;
    }
    if (!activeInput) return;
    setRegData(prev => {
      const currentVal = prev[activeInput];
      if (key === "Backspace") return { ...prev, [activeInput]: currentVal.slice(0, -1) };
      if (activeInput === 'phone' && currentVal.length >= 10) return prev;
      
      let char = "";
      if (key === "Space") char = " ";
      else char = isCaps ? key.toUpperCase() : key.toLowerCase();
      
      const finalChar = /^\d$/.test(key) ? key : char;
      return { ...prev, [activeInput]: currentVal + finalChar };
    });
  };

  const handleRegistration = async () => {
    if (!currentUserId || !currentDeviceId) return;
    if (!regData.name || !regData.rollNo) {
      toast({ variant: "destructive", title: "Missing Info", description: "Name and Roll No are required." });
      return;
    }
    try {
      const db = getDb();
      const docRef = await addDoc(collection(db, "students"), {
        name: regData.name, 
        rollNo: Number(regData.rollNo), 
        className: regData.class || "10A", 
        phone: regData.phone ? `+91${regData.phone}` : "",
        fingerprintID: "NOT_ENROLLED", 
        attendance: {}, 
        userId: currentUserId, 
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, "kiosk_commands"), {
        type: "ENROLL", 
        studentId: docRef.id, 
        studentName: regData.name, 
        deviceId: currentDeviceId, 
        status: "pending", 
        createdAt: serverTimestamp()
      });
      setView("enrollment-step");
    } catch (e) { toast({ variant: "destructive", title: "Error Saving Data" }); }
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col bg-[#020617] transition-all duration-700 overflow-hidden select-none", view === "success" && "bg-emerald-950")}>
      
      <div className="h-9 px-4 flex justify-between items-center bg-slate-900/80 border-b border-white/10 backdrop-blur-xl z-[100]">
        <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <span className="font-black text-[14px] tracking-tight text-white uppercase italic">
                BioSync <span className="text-primary">Box</span>
            </span>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className={cn("h-1.5 w-1.5 rounded-full", systemStatus?.status === 'online' ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" : "bg-rose-500")} />
              <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">
                {isBooting ? "Booting" : (systemStatus?.status || "Offline")}
              </span>
           </div>
           <div className="font-mono text-[12px] font-bold text-white tracking-widest">{format(currentTime, "HH:mm:ss")}</div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center overflow-hidden">
        
        {(view !== "home" && view !== "processing" && view !== "pairing" && view !== "success") && (
          <button 
            onClick={() => { setView("home"); setActiveInput(null); }}
            className="absolute top-4 left-4 z-[160] h-10 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center gap-2 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Home</span>
          </button>
        )}

        {view === "home" && (
          <div className="w-full h-full flex flex-col items-center justify-between py-4 px-6 animate-in fade-in duration-1000">
            <div className="text-center space-y-0 mt-2">
                <div className="text-8xl font-black text-white tracking-tighter italic leading-none text-glow-white">
                    {format(currentTime, "HH:mm")}
                </div>
                <div className="text-lg font-bold text-primary uppercase tracking-[0.5em] mt-1">
                    {format(currentTime, "EEEE, MMM do")}
                </div>
            </div>

            <div className="flex gap-6 w-full max-w-3xl px-2">
                <button 
                    onClick={() => setView("attendance")} 
                    className="group relative flex-1 h-32 bg-slate-900/60 border border-white/10 hover:border-primary/50 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl overflow-hidden"
                >
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                    <Fingerprint className="h-12 w-12 text-primary group-hover:scale-110 transition-all drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <span className="text-2xl font-black text-white uppercase italic tracking-tighter">Attendance</span>
                </button>
                <button 
                    onClick={() => { setRegData({name: "", rollNo: "", class: "", phone: ""}); setView("registration"); }} 
                    className="group relative flex-1 h-32 bg-slate-900/60 border border-white/10 hover:border-emerald-500/50 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl overflow-hidden"
                >
                    <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
                    <UserPlus className="h-12 w-12 text-emerald-500 group-hover:scale-110 transition-all drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-2xl font-black text-white uppercase italic tracking-tighter">Register</span>
                </button>
            </div>

            <div className="w-full bg-slate-900/40 border border-white/5 rounded-2xl p-3 grid grid-cols-4 gap-4 backdrop-blur-md">
                <div className="flex items-center gap-3 border-r border-white/5 pr-4">
                    <Users className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">STUDENTS</span>
                        <span className="text-xs font-bold text-white">{studentCount} ENROLLED</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-r border-white/5 pr-4">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">THERMAL</span>
                        <span className="text-xs font-bold text-white">{systemStatus?.cpu_temp?.toFixed(1) || "--"}°C</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-r border-white/5 pr-4">
                    <Database className="h-4 w-4 text-orange-500" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">BIOMETRIC</span>
                        <span className="text-xs font-bold text-white">{systemStatus?.templates_stored || 0} STORED</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-indigo-400 animate-pulse" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">STATUS</span>
                        <span className="text-xs font-bold text-indigo-400">ACTIVE</span>
                    </div>
                </div>
            </div>
          </div>
        )}

        {view === "registration" && (
            <div className={cn("w-full h-full flex flex-col transition-all duration-500", activeInput && "-translate-y-24")}>
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-slate-900/70 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
                        <h2 className="text-2xl font-black italic uppercase text-primary mb-6 tracking-widest text-center">Student Registration</h2>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div 
                                onClick={() => setActiveInput("name")} 
                                className={cn("col-span-2 px-6 py-3 rounded-2xl border transition-all cursor-pointer", activeInput === "name" ? "border-primary bg-primary/10 shadow-lg" : "border-white/5 bg-white/5")}
                            >
                                <label className="text-[9px] font-black uppercase text-white/40 block tracking-widest mb-1">NAME</label>
                                <div className="text-2xl font-bold truncate h-8 flex items-center">{regData.name || "---"}</div>
                            </div>
                            <div 
                                onClick={() => setActiveInput("rollNo")} 
                                className={cn("px-6 py-3 rounded-2xl border transition-all cursor-pointer", activeInput === "rollNo" ? "border-primary bg-primary/10 shadow-lg" : "border-white/5 bg-white/5")}
                            >
                                <label className="text-[9px] font-black uppercase text-white/40 block tracking-widest mb-1">ROLL NO</label>
                                <div className="text-2xl font-bold h-8 flex items-center">{regData.rollNo || "00"}</div>
                            </div>
                            <div 
                                onClick={() => setActiveInput("class")} 
                                className={cn("px-6 py-3 rounded-2xl border transition-all cursor-pointer", activeInput === "class" ? "border-primary bg-primary/10 shadow-lg" : "border-white/5 bg-white/5")}
                            >
                                <label className="text-[9px] font-black uppercase text-white/40 block tracking-widest mb-1">CLASS</label>
                                <div className="text-2xl font-bold h-8 flex items-center">{regData.class || "10A"}</div>
                            </div>
                            <div 
                                onClick={() => setActiveInput("phone")} 
                                className={cn("col-span-2 px-6 py-3 rounded-2xl border transition-all cursor-pointer", activeInput === "phone" ? "border-primary bg-primary/10 shadow-lg" : "border-white/5 bg-white/5")}
                            >
                                <label className="text-[9px] font-black uppercase text-white/40 block tracking-widest mb-1">PARENT MOBILE (+91)</label>
                                <div className="text-2xl font-bold h-8 flex items-center tracking-widest">{regData.phone || "---"}</div>
                            </div>
                        </div>

                        {!activeInput && (
                            <Button onClick={handleRegistration} className="w-full h-16 mt-6 text-2xl font-black bg-emerald-600 hover:bg-emerald-500 rounded-2xl uppercase italic tracking-tighter shadow-xl">
                                Initialize Enrollment
                            </Button>
                        )}
                    </div>
                </div>

                <div className={cn(
                    "fixed bottom-0 left-0 right-0 bg-[#020617]/98 backdrop-blur-3xl border-t border-white/10 p-4 transition-all duration-500 transform z-[150]",
                    activeInput ? "translate-y-0" : "translate-y-full"
                )}>
                    <div className="flex justify-between items-center mb-3 px-6">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">
                            INPUT: <span className="text-white">{activeInput?.toUpperCase()}</span>
                        </span>
                        <button onClick={() => setActiveInput(null)} className="flex items-center gap-1 text-[10px] font-black text-white/60 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/10">
                            DONE <ChevronDown className="h-4 w-4" />
                        </button>
                    </div>
                    
                    <div className="flex flex-col gap-2 max-w-5xl mx-auto">
                        {(activeInput === 'rollNo' || activeInput === 'phone' ? NUMPAD_LAYOUT : KEYBOARD_LAYOUT).map((row, i) => (
                        <div key={i} className="flex justify-center gap-2 w-full">
                            {row.map(key => (
                            <button 
                                key={key} 
                                onClick={() => onKeyPress(key)} 
                                className={cn(
                                    "h-12 flex-1 min-w-[3.5rem] rounded-xl text-[18px] font-black transition-all active:scale-90 border border-white/5",
                                    key === "Backspace" ? "bg-rose-500/20 text-rose-500 border-rose-500/30" : 
                                    key === "CapsLock" ? cn("bg-indigo-500/20 text-indigo-400 border-indigo-500/30", isCaps && "bg-indigo-500 text-white") :
                                    key === "Space" ? "bg-white/10 text-white flex-[4]" :
                                    "bg-white/10 text-white"
                                )}
                            >
                                {key === "Backspace" ? "DEL" : 
                                 key === "CapsLock" ? (isCaps ? "ABC" : "abc") :
                                 key === "Space" ? "SPACE" :
                                 isCaps && !/^\d$/.test(key) ? key.toUpperCase() : key.toLowerCase()}
                            </button>
                            ))}
                        </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === "attendance" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 animate-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-[120px] rounded-full animate-pulse" />
                <div className="relative bg-primary/10 p-16 rounded-full border-[10px] border-primary/20 shadow-[0_0_80px_-10px_rgba(59,130,246,0.5)]">
                    <Fingerprint className="h-44 w-44 text-primary animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-primary shadow-[0_0_30px_rgba(59,130,246,1)] animate-scan-line" />
                </div>
            </div>
            <div className="space-y-4">
                <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">Scan Finger</h1>
                <div className="flex items-center justify-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-500" />
                    <p className="text-primary font-mono text-[14px] tracking-[0.6em] uppercase font-black animate-pulse">Bio-Identity Verification</p>
                </div>
            </div>
          </div>
        )}

        {view === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in duration-700">
            <div className="bg-emerald-500 p-12 rounded-full scale-110 shadow-[0_0_100px_rgba(16,185,129,0.5)] border-[12px] border-emerald-400/40">
                <CheckCircle2 className="h-44 w-44 text-white" />
            </div>
            <div className="space-y-3">
                <h2 className="text-7xl font-black text-white italic tracking-tighter leading-none text-glow-emerald uppercase">PRESENT</h2>
                <p className="text-4xl text-emerald-300 font-black uppercase tracking-widest">{lastStudent?.name}</p>
            </div>
          </div>
        )}

        {view === "enrollment-step" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-10 animate-in fade-in zoom-in duration-700">
                <Fingerprint className="h-44 w-44 text-emerald-500 animate-pulse drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                <div className="space-y-4">
                    <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">{regData.name}</h1>
                    <div className="text-3xl text-emerald-400 font-mono tracking-widest font-black bg-emerald-500/10 px-10 py-5 rounded-[2rem] border border-emerald-500/20 shadow-2xl">
                        {systemStatus?.enrollment_status || "Initializing..."}
                    </div>
                </div>
            </div>
        )}

        {view === "processing" && (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-line {
            0% { top: 0; }
            50% { top: 100%; }
            100% { top: 0; }
        }
        .animate-scan-line { animation: scan-line 3s linear infinite; }
        .text-glow-white { text-shadow: 0 0 30px rgba(255,255,255,0.3); }
        .text-glow-emerald { text-shadow: 0 0 40px rgba(16,185,129,0.5); }
      `}</style>
    </div>
  );
}
