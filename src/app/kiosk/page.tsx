
"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { 
  Fingerprint, 
  CheckCircle2, 
  UserPlus, 
  Loader2,
  CalendarCheck,
  Cpu,
  Activity,
  Users,
  Database,
  ChevronLeft,
  ShieldCheck,
  Zap,
  Link as LinkIcon,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  getCountFromServer,
  updateDoc,
  getDoc
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
    }, 20);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[200]">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/30 blur-[100px] rounded-full animate-pulse" />
        <div className="relative p-12 bg-slate-900/50 rounded-full border border-primary/20 shadow-2xl">
            <CalendarCheck className="h-32 w-32 text-primary animate-bounce" />
        </div>
      </div>
      <h1 className="text-7xl font-black text-white italic tracking-tighter uppercase mb-4 text-glow-white">
        BioSync <span className="text-primary">Box</span>
      </h1>
      <p className="text-primary/60 font-mono text-xl tracking-[0.8em] uppercase font-bold mb-12">OS KERNEL v2.8.5.PRO</p>
      <div className="w-96 space-y-4">
        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
          <div className="h-full bg-primary shadow-[0_0_20px_rgba(59,130,246,1)] transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

function KioskContent() {
  const searchParams = useSearchParams();
  const urlDeviceId = searchParams.get("deviceId");
  
  const [isBooting, setIsBooting] = useState(true);
  const [view, setView] = useState<"pairing" | "home" | "attendance" | "registration" | "enrollment-step" | "success" | "processing" | "no-match">("processing");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [lastStudentName, setLastStudentName] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [isCaps, setIsCaps] = useState(true);
  const { toast } = useToast();

  const [regData, setRegData] = useState({ name: "", rollNo: "", class: "", phone: "" });
  const [activeInput, setActiveInput] = useState<keyof typeof regData | null>(null);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const bootTimer = setTimeout(() => setIsBooting(false), 3000);
    return () => { clearInterval(clockTimer); clearTimeout(bootTimer); };
  }, []);

  useEffect(() => {
    const db = getDb();
    let serial = urlDeviceId;
    if (!serial && typeof window !== 'undefined') serial = localStorage.getItem("pi_serial_mock");
    if (!serial) {
        serial = "PI_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        if (typeof window !== 'undefined') localStorage.setItem("pi_serial_mock", serial);
    }
    setCurrentDeviceId(serial);

    const statusRef = doc(db, "system_status", serial);
    
    const unsubscribeStatus = onSnapshot(statusRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemStatus(data);
        setCurrentUserId(data.userId);
        
        if (data.userId) {
          if (view === "pairing" || view === "processing") setView("home");
          
          try {
            // Count students in the specific institute's sub-collection
            const qCount = collection(db, "institutes", data.userId, "students");
            const countSnap = await getCountFromServer(qCount);
            setStudentCount(countSnap.data().count);
          } catch (e) {
            console.error("Student count error:", e);
          }
        } else {
          setView("pairing");
        }

        if (data.enrollment_status === "SUCCESS") {
            setTimeout(() => setView("home"), 2000);
        }

        // Attendance Detection
        if (data.scan_status === "success" && view === "attendance") {
            setLastStudentName(data.last_student_name || "Unknown Student");
            setView("success");
            setTimeout(() => setView("home"), 3500);
        } else if (data.scan_status === "no_match" && view === "attendance") {
            setView("no-match");
            setTimeout(() => setView("attendance"), 2000);
        }
        
        if (data.enrollment_status === "HARDWARE_ERROR" || data.enrollment_status === "MATCH_ERROR") {
            setTimeout(() => {
                updateDoc(statusRef, { enrollment_status: "IDLE" }).catch(e => console.error("Status reset error:", e));
                setView("registration");
            }, 4000);
        }
      } else if (serial) {
        setDoc(statusRef, { 
            deviceId: serial, 
            pairing_token: Math.floor(100000 + Math.random() * 900000).toString(), 
            status: "online", 
            last_online: serverTimestamp(), 
            hardware_ready: true, 
            templates_stored: 0,
            enrollment_status: "IDLE",
            scan_status: "idle"
        }, { merge: true }).catch(e => console.error("Initial setDoc error:", e));
      }
    }, (err) => {
      console.log("Kiosk Status Listener Error:", err.message);
    });

    return () => unsubscribeStatus();
  }, [urlDeviceId, view]);

  const handleStartAttendance = async () => {
    if (!currentDeviceId || !currentUserId) return;
    try {
        const db = getDb();
        await addDoc(collection(db, "kiosk_commands"), {
            type: "START_ATTENDANCE",
            deviceId: currentDeviceId,
            userId: currentUserId,
            status: "pending",
            createdAt: serverTimestamp()
        });
        setView("attendance");
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Failed to trigger attendance." });
    }
  };

  const handleBack = async () => {
    const db = getDb();
    if (view === "attendance" && currentDeviceId) {
        await addDoc(collection(db, "kiosk_commands"), {
            type: "END_ATTENDANCE",
            deviceId: currentDeviceId,
            status: "pending",
            createdAt: serverTimestamp()
        });
    }
    
    if (view === "enrollment-step") setView("registration");
    else if (view === "registration" || view === "attendance") { setView("home"); setActiveInput(null); }
    else if (activeInput) setActiveInput(null);
  };

  const onKeyPress = (key: string) => {
    if (key === "CapsLock") { setIsCaps(!isCaps); return; }
    if (!activeInput) return;
    setRegData(prev => {
      const currentVal = prev[activeInput];
      if (key === "Backspace") return { ...prev, [activeInput]: currentVal.slice(0, -1) };
      if (activeInput === 'phone' && currentVal.length >= 10) return prev;
      let char = (key === "Space") ? " " : (isCaps ? key.toUpperCase() : key.toLowerCase());
      const finalChar = /^\d$/.test(key) ? key : char;
      return { ...prev, [activeInput]: currentVal + finalChar };
    });
  };

  const handleRegistration = async () => {
    if (!currentUserId || !currentDeviceId) {
      toast({ variant: "destructive", title: "Pairing Required", description: "This device is not linked to any institute." });
      return;
    }
    if (!regData.name || !regData.rollNo) {
      toast({ variant: "destructive", title: "Input Missing", description: "Name and Roll No are required." });
      return;
    }
    
    try {
      const db = getDb();
      
      // 1. Update status to preparing
      await updateDoc(doc(db, "system_status", currentDeviceId), { enrollment_status: "PREPARING" });
      
      // 2. Add student to institute section
      // Path: institutes/{userId}/students/{studentId}
      const studentCol = collection(db, "institutes", currentUserId, "students");
      const docRef = await addDoc(studentCol, {
        name: regData.name, 
        rollNo: Number(regData.rollNo), 
        className: regData.class || "10A", 
        phone: regData.phone ? `+91${regData.phone}` : "",
        fingerprintID: "NOT_ENROLLED", 
        attendance: {}, 
        userId: currentUserId, 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Command Pi to start enrollment
      await addDoc(collection(db, "kiosk_commands"), {
        type: "ENROLL", 
        studentId: docRef.id, 
        userId: currentUserId, 
        studentName: regData.name, 
        deviceId: currentDeviceId, 
        status: "pending", 
        createdAt: serverTimestamp()
      });

      setView("enrollment-step");
    } catch (e: any) { 
      console.error("Registration Error:", e);
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: e.message || "Database Error." 
      }); 
    }
  };

  const getEnrollmentMessage = () => {
    switch(systemStatus?.enrollment_status) {
        case "PREPARING": return "CALIBRATING SENSOR...";
        case "PLACE_FINGER": return "PLACE FINGER ON SENSOR";
        case "REMOVE_FINGER": return "REMOVE YOUR FINGER";
        case "PLACE_AGAIN": return "PLACE SAME FINGER AGAIN";
        case "SUCCESS": return "ENROLLMENT SUCCESSFUL!";
        case "ERROR_IMAGE": return "SCAN ERROR! TRY AGAIN";
        case "MATCH_ERROR": return "FINGERS DO NOT MATCH";
        case "HARDWARE_ERROR": return "SENSOR BUSY! RESTARTING...";
        default: return "INITIALIZING...";
    }
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col bg-[#020617] transition-all duration-700 overflow-hidden select-none", view === "success" && "bg-emerald-950", view === "no-match" && "bg-rose-950")}>
      
      {/* MEGA HEADER */}
      <div className="h-28 px-12 flex justify-between items-center bg-slate-900/95 border-b border-white/10 backdrop-blur-3xl z-[100] shrink-0">
        <div className="flex items-center gap-8">
            <CalendarCheck className="h-14 w-14 text-primary" />
            <span className="font-black text-5xl tracking-tighter text-white uppercase italic">
                BioSync <span className="text-primary">Box</span>
            </span>
        </div>
        <div className="flex items-center gap-12">
           <div className="flex items-center gap-4 bg-black/40 px-8 py-3 rounded-3xl border border-white/5">
              <div className={cn("h-4 w-4 rounded-full", systemStatus?.status === 'online' ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
              <span className="text-xl font-black text-white uppercase tracking-widest">
                {systemStatus?.status || "OFFLINE"}
              </span>
           </div>
           <div className="font-mono text-4xl font-bold text-white tracking-widest bg-primary/10 px-8 py-3 rounded-3xl border border-primary/20">
             {format(currentTime, "HH:mm")}
           </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        
        {(view !== "home" && view !== "processing" && view !== "pairing" && view !== "success" && view !== "no-match") && (
          <button 
            onClick={handleBack}
            className="absolute top-8 left-10 z-[160] h-20 px-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2rem] flex items-center gap-4 text-white transition-all active:scale-95 shadow-2xl"
          >
            <ChevronLeft className="h-10 w-10" />
            <span className="text-xl font-black uppercase tracking-widest">BACK</span>
          </button>
        )}

        {view === "pairing" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12 p-8">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative p-12 bg-slate-900/50 rounded-[4rem] border border-primary/20 shadow-2xl">
                    <LinkIcon className="h-24 w-24 text-primary animate-pulse" />
                </div>
            </div>
            <div className="space-y-6">
                <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter">Pair Device</h2>
                <p className="text-slate-400 text-2xl font-medium max-w-2xl leading-relaxed">
                  Enter token in Dashboard <span className="text-primary italic font-bold">Device Center</span>
                </p>
            </div>
            
            <div className="bg-primary/10 border-2 border-primary/30 px-24 py-12 rounded-[4rem] shadow-2xl">
                <span className="text-[7rem] font-black text-white tracking-[0.1em] font-mono leading-none block text-glow-white">
                    {systemStatus?.pairing_token || "------"}
                </span>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="w-full h-full flex flex-col items-center justify-between py-16 px-10 animate-in fade-in duration-700">
            <div className="text-center">
                <div className="text-[12rem] font-black text-white tracking-tighter italic leading-none text-glow-white">
                    {format(currentTime, "HH:mm")}
                </div>
                <div className="text-4xl font-bold text-primary uppercase tracking-[0.4em] mt-8">
                    {format(currentTime, "EEEE, MMM do")}
                </div>
            </div>

            <div className="flex gap-12 w-full max-w-[1400px]">
                <button 
                    onClick={handleStartAttendance} 
                    className="group relative flex-1 h-[350px] bg-slate-900/60 border-4 border-white/10 hover:border-primary/50 rounded-[4rem] flex flex-col items-center justify-center gap-8 transition-all active:scale-95 shadow-2xl"
                >
                    <div className="p-8 bg-primary/10 rounded-full border border-primary/20">
                        <Fingerprint className="h-32 w-28 text-primary drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]" />
                    </div>
                    <span className="text-6xl font-black text-white uppercase italic tracking-tighter">Attendance</span>
                </button>
                <button 
                    onClick={() => { setRegData({name: "", rollNo: "", class: "", phone: ""}); setView("registration"); }} 
                    className="group relative flex-1 h-[350px] bg-slate-900/60 border-4 border-white/10 hover:border-emerald-500/50 rounded-[4rem] flex flex-col items-center justify-center gap-8 transition-all active:scale-95 shadow-2xl"
                >
                    <div className="p-8 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                        <UserPlus className="h-32 w-28 text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]" />
                    </div>
                    <span className="text-6xl font-black text-white uppercase italic tracking-tighter">Register</span>
                </button>
            </div>

            <div className="w-full max-w-[1400px] bg-slate-900/40 border-2 border-white/10 rounded-[3rem] p-10 grid grid-cols-3 gap-12 backdrop-blur-md">
                <div className="flex items-center gap-6 border-r border-white/10">
                    <Users className="h-12 w-12 text-primary" />
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-white/30 uppercase">STUDENTS</span>
                        <span className="text-3xl font-bold text-white">{studentCount}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6 border-r border-white/10">
                    <Database className="h-12 w-12 text-orange-500" />
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-white/30 uppercase">STORAGE</span>
                        <span className="text-3xl font-bold text-white">{systemStatus?.templates_stored || 0}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <Activity className="h-12 w-12 text-indigo-400" />
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-white/30 uppercase">KERNEL</span>
                        <span className="text-2xl font-bold text-indigo-400 uppercase italic">v2.8.5 PRO</span>
                    </div>
                </div>
            </div>
          </div>
        )}

        {view === "registration" && (
            <div className={cn("w-full h-full flex flex-col transition-all duration-500", activeInput && "-translate-y-48")}>
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="w-full max-w-[1200px] bg-slate-900/80 backdrop-blur-3xl p-16 rounded-[4rem] border-2 border-white/10 shadow-2xl">
                        <h2 className="text-6xl font-black italic uppercase text-primary mb-12 tracking-widest text-center border-b-2 border-white/5 pb-8">Enroll Student</h2>
                        <div className="grid grid-cols-2 gap-8">
                            <div onClick={() => setActiveInput("name")} className={cn("col-span-2 px-12 py-8 rounded-3xl border-4 transition-all cursor-pointer", activeInput === "name" ? "border-primary bg-primary/10" : "border-white/5 bg-white/5")}>
                                <label className="text-lg font-black uppercase text-white/40 block tracking-widest mb-4">FULL NAME</label>
                                <div className="text-5xl font-bold truncate h-16 flex items-center">{regData.name || "---"}</div>
                            </div>
                            <div onClick={() => setActiveInput("rollNo")} className={cn("px-12 py-8 rounded-3xl border-4 transition-all cursor-pointer", activeInput === "rollNo" ? "border-primary bg-primary/10" : "border-white/5 bg-white/5")}>
                                <label className="text-lg font-black uppercase text-white/40 block tracking-widest mb-4">ROLL NO</label>
                                <div className="text-5xl font-bold h-16 flex items-center">{regData.rollNo || "00"}</div>
                            </div>
                            <div onClick={() => setActiveInput("class")} className={cn("px-12 py-8 rounded-3xl border-4 transition-all cursor-pointer", activeInput === "class" ? "border-primary bg-primary/10" : "border-white/5 bg-white/5")}>
                                <label className="text-lg font-black uppercase text-white/40 block tracking-widest mb-4">CLASS</label>
                                <div className="text-5xl font-bold h-16 flex items-center">{regData.class || "10A"}</div>
                            </div>
                        </div>
                        {!activeInput && (
                            <Button onClick={handleRegistration} className="w-full h-28 mt-12 text-5xl font-black bg-emerald-600 hover:bg-emerald-500 rounded-3xl uppercase italic tracking-tighter shadow-2xl">
                                Start Biometric Scan
                            </Button>
                        )}
                    </div>
                </div>

                <div className={cn("fixed bottom-0 left-0 right-0 bg-slate-950/98 backdrop-blur-3xl border-t-2 border-white/10 p-10 transition-all duration-500 z-[150]", activeInput ? "translate-y-0" : "translate-y-full")}>
                    <div className="flex justify-between items-center mb-8">
                        <span className="text-2xl font-black text-primary uppercase">INPUT: <span className="text-white">{activeInput?.toUpperCase()}</span></span>
                        <button onClick={() => setActiveInput(null)} className="h-14 px-10 bg-emerald-600 rounded-full font-black text-xl uppercase text-white">CONFIRM</button>
                    </div>
                    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto">
                        {(activeInput === 'rollNo' ? NUMPAD_LAYOUT : KEYBOARD_LAYOUT).map((row, i) => (
                        <div key={i} className="flex justify-center gap-4">
                            {row.map(key => (
                            <button key={key} onClick={() => onKeyPress(key)} className={cn("h-20 flex-1 min-w-[6rem] rounded-2xl text-3xl font-black transition-all active:scale-90", key === "Backspace" ? "bg-rose-500 text-white" : key === "CapsLock" ? cn("bg-indigo-500/20 text-indigo-400", isCaps && "bg-indigo-500 text-white") : "bg-white/10 text-white border border-white/5 shadow-xl")}>
                                {key === "Backspace" ? "DEL" : key === "CapsLock" ? "ABC" : key === "Space" ? "SPACE" : isCaps ? key.toUpperCase() : key.toLowerCase()}
                            </button>
                            ))}
                        </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {view === "attendance" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-[150px] rounded-full animate-pulse" />
                <div className="relative bg-primary/10 p-32 rounded-full border-[20px] border-primary/20 shadow-2xl">
                    <Fingerprint className="h-64 w-64 text-primary animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary shadow-[0_0_50px_rgba(59,130,246,1)] animate-scan-line" />
                </div>
            </div>
            <div className="space-y-8">
                <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter">Scan Finger</h1>
                <div className="flex items-center justify-center gap-6 bg-white/5 px-10 py-4 rounded-full border border-white/10">
                    <ShieldCheck className="h-10 w-10 text-emerald-500" />
                    <p className="text-primary font-mono text-2xl tracking-[0.4em] uppercase font-black">Bio-Identity Active</p>
                </div>
            </div>
          </div>
        )}

        {view === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-700">
            <div className="bg-emerald-500 p-24 rounded-full scale-110 shadow-[0_0_150px_rgba(16,185,129,0.6)] border-[20px] border-emerald-400/40">
                <CheckCircle2 className="h-48 w-48 text-white" />
            </div>
            <div className="space-y-8">
                <h2 className="text-9xl font-black text-white italic tracking-tighter uppercase text-glow-emerald">PRESENT</h2>
                <p className="text-6xl text-emerald-300 font-black uppercase tracking-widest">{lastStudentName}</p>
            </div>
          </div>
        )}

        {view === "no-match" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-700">
            <div className="bg-rose-500 p-24 rounded-full scale-110 shadow-[0_0_150px_rgba(244,63,94,0.6)] border-[20px] border-rose-400/40">
                <XCircle className="h-48 w-48 text-white" />
            </div>
            <div className="space-y-8">
                <h2 className="text-9xl font-black text-white italic tracking-tighter uppercase text-glow-rose">NO MATCH</h2>
                <p className="text-4xl text-rose-300 font-black uppercase tracking-widest">ID NOT FOUND IN DATABASE</p>
            </div>
          </div>
        )}

        {view === "enrollment-step" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in fade-in zoom-in duration-700">
                <div className="relative p-16 bg-emerald-500/10 rounded-full border-[15px] border-emerald-500/20 shadow-2xl">
                    {systemStatus?.enrollment_status?.includes("ERROR") ? (
                        <AlertTriangle className="h-48 w-48 text-rose-500 animate-pulse" />
                    ) : (
                        <Fingerprint className="h-48 w-48 text-emerald-500 animate-pulse" />
                    )}
                </div>
                <div className="space-y-10">
                    <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{regData.name}</h1>
                    <div className={cn(
                        "text-5xl font-mono tracking-[0.2em] font-black px-16 py-8 rounded-[3rem] border-4 shadow-2xl",
                        systemStatus?.enrollment_status?.includes("ERROR") ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    )}>
                        {getEnrollmentMessage()}
                    </div>
                </div>
            </div>
        )}

        {view === "processing" && (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-48 w-48 text-primary animate-spin" />
            </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-line { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-scan-line { animation: scan-line 4s linear infinite; }
        .text-glow-white { text-shadow: 0 0 40px rgba(255,255,255,0.4); }
        .text-glow-emerald { text-shadow: 0 0 60px rgba(16,185,129,0.6); }
        .text-glow-rose { text-shadow: 0 0 60px rgba(244,63,94,0.6); }
      `}</style>
    </div>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<BootingScreen />}>
      <KioskContent />
    </Suspense>
  );
}
