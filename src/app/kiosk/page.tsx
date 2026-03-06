
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
  Link as LinkIcon
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
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/30 blur-[100px] rounded-full animate-pulse" />
        <div className="relative p-12 bg-slate-900/50 rounded-full border border-primary/20 shadow-2xl">
            <CalendarCheck className="h-24 w-24 text-primary animate-bounce" />
        </div>
      </div>
      <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2 text-glow-white">
        BioSync <span className="text-primary">Box</span>
      </h1>
      <p className="text-primary/60 font-mono text-xs tracking-[0.8em] uppercase font-bold mb-8">OS KERNEL v2.8.5.PRO</p>
      <div className="w-80 space-y-4">
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
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
    let serial = urlDeviceId;
    if (!serial && typeof window !== 'undefined') serial = localStorage.getItem("pi_serial_mock");
    if (!serial) {
        serial = "PI_" + Math.random().toString(36).substr(2, 6).toUpperCase();
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
        } else setView("pairing");
      } else if (serial) {
        setDoc(statusRef, { 
            deviceId: serial, 
            pairing_token: Math.floor(100000 + Math.random() * 900000).toString(), 
            status: "online", 
            last_online: serverTimestamp(), 
            hardware_ready: true, 
            templates_stored: 0 
        });
      }
    });
  }, [urlDeviceId]);

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

  const handleBack = () => {
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
    if (!currentUserId || !currentDeviceId) return;
    if (!regData.name || !regData.rollNo) {
      toast({ variant: "destructive", title: "Input Missing", description: "Name/Roll No required." });
      return;
    }
    try {
      const db = getDb();
      const docRef = await addDoc(collection(db, "students"), {
        name: regData.name, rollNo: Number(regData.rollNo), 
        className: regData.class || "10A", phone: regData.phone ? `+91${regData.phone}` : "",
        fingerprintID: "NOT_ENROLLED", attendance: {}, userId: currentUserId, createdAt: serverTimestamp()
      });
      await addDoc(collection(db, "kiosk_commands"), {
        type: "ENROLL", studentId: docRef.id, studentName: regData.name, 
        deviceId: currentDeviceId, status: "pending", createdAt: serverTimestamp()
      });
      setView("enrollment-step");
    } catch (e) { toast({ variant: "destructive", title: "DB Error" }); }
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col bg-[#020617] transition-all duration-700 overflow-hidden select-none", view === "success" && "bg-emerald-950")}>
      
      {/* MEGA HEADER: Scaled for hardware screen */}
      <div className="h-32 px-12 flex justify-between items-center bg-slate-900/95 border-b border-white/10 backdrop-blur-3xl z-[100] shrink-0">
        <div className="flex items-center gap-10">
            <div className="p-4 bg-primary/10 rounded-[2rem] border border-primary/20">
                <CalendarCheck className="h-16 w-16 text-primary" />
            </div>
            <span className="font-black text-6xl tracking-tighter text-white uppercase italic">
                BioSync <span className="text-primary">Box</span>
            </span>
        </div>
        <div className="flex items-center gap-16">
           <div className="flex items-center gap-8 bg-black/40 px-10 py-5 rounded-[2.5rem] border border-white/5">
              <div className={cn("h-6 w-6 rounded-full", systemStatus?.status === 'online' ? "bg-emerald-500 animate-pulse shadow-[0_0_20px_rgba(16,185,129,1)]" : "bg-rose-500")} />
              <span className="text-3xl font-black text-white uppercase tracking-[0.2em]">
                {systemStatus?.status || "OFFLINE"}
              </span>
           </div>
           <div className="font-mono text-6xl font-bold text-white tracking-widest bg-primary/10 px-12 py-5 rounded-[2.5rem] border border-primary/20 shadow-2xl">
             {format(currentTime, "HH:mm")}
           </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        
        {(view !== "home" && view !== "processing" && view !== "pairing" && view !== "success") && (
          <button 
            onClick={handleBack}
            className="absolute top-10 left-12 z-[160] h-24 px-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[3rem] flex items-center gap-8 text-white transition-all active:scale-95 shadow-2xl"
          >
            <ChevronLeft className="h-14 w-14" />
            <span className="text-2xl font-black uppercase tracking-[0.3em]">BACK</span>
          </button>
        )}

        {view === "pairing" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20 p-12">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[150px] rounded-full animate-pulse" />
                <div className="relative p-20 bg-slate-900/50 rounded-[6rem] border border-primary/20 shadow-2xl">
                    <LinkIcon className="h-40 w-40 text-primary animate-pulse" />
                </div>
            </div>
            <div className="space-y-10">
                <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter">Pair Device</h2>
                <p className="text-slate-400 text-4xl font-medium max-w-4xl leading-relaxed">
                  Enter token in Dashboard <span className="text-primary italic font-bold">Device Center</span>
                </p>
            </div>
            
            <div className="bg-primary/10 border-2 border-primary/30 px-32 py-20 rounded-[6rem] shadow-[0_0_150px_rgba(59,130,246,0.3)]">
                <span className="text-[12rem] font-black text-white tracking-[0.2em] font-mono leading-none block text-glow-white">
                    {systemStatus?.pairing_token || "------"}
                </span>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="w-full h-full flex flex-col items-center justify-between py-24 px-12 animate-in fade-in duration-1000">
            <div className="text-center">
                <div className="text-[240px] font-black text-white tracking-tighter italic leading-none text-glow-white">
                    {format(currentTime, "HH:mm")}
                </div>
                <div className="text-6xl font-bold text-primary uppercase tracking-[0.6em] mt-16">
                    {format(currentTime, "EEEE, MMM do")}
                </div>
            </div>

            <div className="flex gap-20 w-full max-w-[1600px]">
                <button 
                    onClick={() => setView("attendance")} 
                    className="group relative flex-1 h-[450px] bg-slate-900/60 border-4 border-white/10 hover:border-primary/50 rounded-[6rem] flex flex-col items-center justify-center gap-16 transition-all active:scale-95 shadow-2xl"
                >
                    <div className="p-12 bg-primary/10 rounded-full border border-primary/20 group-hover:scale-110 transition-transform">
                        <Fingerprint className="h-48 w-40 text-primary drop-shadow-[0_0_50px_rgba(59,130,246,0.8)]" />
                    </div>
                    <span className="text-8xl font-black text-white uppercase italic tracking-tighter">Attendance</span>
                </button>
                <button 
                    onClick={() => { setRegData({name: "", rollNo: "", class: "", phone: ""}); setView("registration"); }} 
                    className="group relative flex-1 h-[450px] bg-slate-900/60 border-4 border-white/10 hover:border-emerald-500/50 rounded-[6rem] flex flex-col items-center justify-center gap-16 transition-all active:scale-95 shadow-2xl"
                >
                    <div className="p-12 bg-emerald-500/10 rounded-full border border-emerald-500/20 group-hover:scale-110 transition-transform">
                        <UserPlus className="h-48 w-40 text-emerald-500 drop-shadow-[0_0_50px_rgba(16,185,129,0.8)]" />
                    </div>
                    <span className="text-8xl font-black text-white uppercase italic tracking-tighter">Register</span>
                </button>
            </div>

            <div className="w-full max-w-[1600px] bg-slate-900/40 border-2 border-white/10 rounded-[5rem] p-16 grid grid-cols-3 gap-20 backdrop-blur-md">
                <div className="flex items-center gap-10 border-r border-white/10">
                    <Users className="h-24 w-24 text-primary" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-white/30 uppercase tracking-widest">STUDENTS</span>
                        <span className="text-5xl font-bold text-white">{studentCount} IDs</span>
                    </div>
                </div>
                <div className="flex items-center gap-10 border-r border-white/10">
                    <Database className="h-24 w-24 text-orange-500" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-white/30 uppercase tracking-widest">STORAGE</span>
                        <span className="text-5xl font-bold text-white">{systemStatus?.templates_stored || 0} DAT</span>
                    </div>
                </div>
                <div className="flex items-center gap-10">
                    <Zap className="h-24 w-24 text-indigo-400 animate-pulse" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-white/30 uppercase tracking-widest">KERNEL</span>
                        <span className="text-5xl font-bold text-indigo-400 uppercase italic">ACTIVE</span>
                    </div>
                </div>
            </div>
          </div>
        )}

        {view === "registration" && (
            <div className={cn("w-full h-full flex flex-col transition-all duration-500", activeInput && "-translate-y-64")}>
                <div className="flex-1 flex flex-col items-center justify-center p-12">
                    <div className="w-full max-w-[1400px] bg-slate-900/80 backdrop-blur-3xl p-24 rounded-[6rem] border-2 border-white/10 shadow-2xl">
                        <h2 className="text-8xl font-black italic uppercase text-primary mb-24 tracking-widest text-center border-b-2 border-white/5 pb-16">Enroll Student</h2>
                        <div className="grid grid-cols-2 gap-16">
                            <div onClick={() => setActiveInput("name")} className={cn("col-span-2 px-20 py-12 rounded-[4rem] border-4 transition-all cursor-pointer", activeInput === "name" ? "border-primary bg-primary/10 shadow-[0_0_50px_rgba(59,130,246,0.2)]" : "border-white/5 bg-white/5")}>
                                <label className="text-2xl font-black uppercase text-white/40 block tracking-widest mb-6">FULL NAME</label>
                                <div className="text-7xl font-bold truncate h-24 flex items-center">{regData.name || "---"}</div>
                            </div>
                            <div onClick={() => setActiveInput("rollNo")} className={cn("px-20 py-12 rounded-[4rem] border-4 transition-all cursor-pointer", activeInput === "rollNo" ? "border-primary bg-primary/10 shadow-[0_0_50px_rgba(59,130,246,0.2)]" : "border-white/5 bg-white/5")}>
                                <label className="text-2xl font-black uppercase text-white/40 block tracking-widest mb-6">ROLL NO</label>
                                <div className="text-7xl font-bold h-24 flex items-center">{regData.rollNo || "00"}</div>
                            </div>
                            <div onClick={() => setActiveInput("class")} className={cn("px-20 py-12 rounded-[4rem] border-4 transition-all cursor-pointer", activeInput === "class" ? "border-primary bg-primary/10 shadow-[0_0_50px_rgba(59,130,246,0.2)]" : "border-white/5 bg-white/5")}>
                                <label className="text-2xl font-black uppercase text-white/40 block tracking-widest mb-6">CLASS</label>
                                <div className="text-7xl font-bold h-24 flex items-center">{regData.class || "10A"}</div>
                            </div>
                        </div>
                        {!activeInput && (
                            <Button onClick={handleRegistration} className="w-full h-40 mt-24 text-7xl font-black bg-emerald-600 hover:bg-emerald-500 rounded-[4.5rem] uppercase italic tracking-tighter shadow-2xl transition-all active:scale-95">
                                Start Biometric Scan
                            </Button>
                        )}
                    </div>
                </div>

                <div className={cn("fixed bottom-0 left-0 right-0 bg-slate-950/98 backdrop-blur-3xl border-t-2 border-white/10 p-16 transition-all duration-500 z-[150]", activeInput ? "translate-y-0" : "translate-y-full")}>
                    <div className="flex justify-between items-center mb-12">
                        <span className="text-4xl font-black text-primary uppercase tracking-[0.5em]">INPUT: <span className="text-white">{activeInput?.toUpperCase()}</span></span>
                        <button onClick={() => setActiveInput(null)} className="h-20 px-16 bg-emerald-600 rounded-full font-black text-3xl uppercase text-white shadow-2xl">CONFIRM</button>
                    </div>
                    <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
                        {(activeInput === 'rollNo' ? NUMPAD_LAYOUT : KEYBOARD_LAYOUT).map((row, i) => (
                        <div key={i} className="flex justify-center gap-8">
                            {row.map(key => (
                            <button key={key} onClick={() => onKeyPress(key)} className={cn("h-28 flex-1 min-w-[8rem] rounded-[2.5rem] text-5xl font-black transition-all active:scale-90", key === "Backspace" ? "bg-rose-500 text-white" : key === "CapsLock" ? cn("bg-indigo-500/20 text-indigo-400", isCaps && "bg-indigo-500 text-white") : "bg-white/10 text-white hover:bg-white/20 border border-white/5 shadow-xl")}>
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
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-24 animate-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-[200px] rounded-full animate-pulse" />
                <div className="relative bg-primary/10 p-56 rounded-full border-[30px] border-primary/20 shadow-2xl">
                    <Fingerprint className="h-[400px] w-[400px] text-primary animate-pulse" />
                    <div className="absolute top-0 left-0 w-full h-[15px] bg-primary shadow-[0_0_100px_rgba(59,130,246,1)] animate-scan-line" />
                </div>
            </div>
            <div className="space-y-12">
                <h1 className="text-[14rem] font-black text-white italic uppercase tracking-tighter leading-none">Scan Finger</h1>
                <div className="flex items-center justify-center gap-12 bg-white/5 px-16 py-8 rounded-full border border-white/10">
                    <ShieldCheck className="h-20 w-24 text-emerald-500" />
                    <p className="text-primary font-mono text-4xl tracking-[0.8em] uppercase font-black animate-pulse">Bio-Identity Active</p>
                </div>
            </div>
          </div>
        )}

        {view === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-24 animate-in zoom-in duration-700">
            <div className="bg-emerald-500 p-40 rounded-full scale-110 shadow-[0_0_200px_rgba(16,185,129,0.6)] border-[30px] border-emerald-400/40">
                <CheckCircle2 className="h-[350px] w-[350px] text-white" />
            </div>
            <div className="space-y-12">
                <h2 className="text-[16rem] font-black text-white italic tracking-tighter leading-none uppercase text-glow-emerald">PRESENT</h2>
                <p className="text-[9rem] text-emerald-300 font-black uppercase tracking-[0.3em]">{lastStudent?.name}</p>
            </div>
          </div>
        )}

        {view === "enrollment-step" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-24 animate-in fade-in zoom-in duration-700">
                <div className="relative p-24 bg-emerald-500/10 rounded-full border-[20px] border-emerald-500/20 shadow-2xl">
                    <Fingerprint className="h-[350px] w-[350px] text-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-16">
                    <h1 className="text-[10rem] font-black text-white italic uppercase tracking-tighter leading-none">{regData.name}</h1>
                    <div className="text-8xl text-emerald-400 font-mono tracking-[0.3em] font-black bg-emerald-500/10 px-32 py-16 rounded-[5rem] border-4 border-emerald-500/30 shadow-2xl">
                        {systemStatus?.enrollment_status || "WAITING FOR SCAN..."}
                    </div>
                </div>
            </div>
        )}

        {view === "processing" && (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-64 w-64 text-primary animate-spin" />
            </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-line { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-scan-line { animation: scan-line 4s linear infinite; }
        .text-glow-white { text-shadow: 0 0 60px rgba(255,255,255,0.4); }
        .text-glow-emerald { text-shadow: 0 0 100px rgba(16,185,129,0.6); }
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
