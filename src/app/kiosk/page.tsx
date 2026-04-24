
"use client";

import * as React from "react";
import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from "react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { 
  Fingerprint, 
  CheckCircle2, 
  Loader2,
  CalendarCheck,
  Activity,
  Users,
  Database,
  ChevronLeft,
  ShieldCheck,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Cpu,
  Lock,
  Wifi,
  WifiOff,
  Zap,
  Globe,
  AlertCircle,
  UserCheck,
  XCircle,
  Clock
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
  setDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "firebase/firestore";

const BootingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("INITIALIZING SYSTEM...");

  useEffect(() => {
    const statusMessages = [
      "LOADING KERNEL...",
      "SYNCING BIOMETRIC DATABASE...",
      "ESTABLISHING SECURE LINK...",
      "READY TO ATTEND"
    ];
    
    let msgIndex = 0;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        if (prev % 25 === 0 && msgIndex < statusMessages.length) {
            setStatus(statusMessages[msgIndex]);
            msgIndex++;
        }
        return prev + 1;
      });
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[200]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      
      <div className="relative mb-12 flex flex-col items-center">
        <div className="relative p-12 bg-slate-900/50 rounded-[3rem] border border-primary/20 shadow-[0_0_80px_-20px_rgba(59,130,246,0.5)] mb-8">
            <CalendarCheck className="h-32 w-32 text-primary animate-bounce" />
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-3 rounded-2xl shadow-lg border-2 border-white/10">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
        </div>
        <h1 className="text-8xl font-black text-white italic tracking-tighter uppercase mb-2 text-glow-white">
          BioSync <span className="text-primary">Box</span>
        </h1>
        <p className="text-primary/60 font-mono text-xl tracking-[0.8em] uppercase font-bold">OS KERNEL v14.8.PRO</p>
      </div>

      <div className="w-96 space-y-6">
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
          <div className="h-full bg-primary shadow-[0_0_25px_rgba(59,130,246,1)] transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-black italic">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                {status}
            </div>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">{progress}% LOADED</p>
        </div>
      </div>
    </div>
  );
};

function KioskContent() {
  const searchParams = useSearchParams();
  const urlDeviceId = searchParams.get("deviceId");
  
  const [isBooting, setIsBooting] = useState(true);
  const [view, setView] = useState<"pairing" | "home" | "attendance" | "registration" | "enrollment-step" | "success" | "processing" | "class-selection" | "daily-report" | "mismatch" | "already-present">("processing");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [lastStudentName, setLastStudentName] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  
  const isInitialized = useRef(false);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const bootTimer = setTimeout(() => {
      setIsBooting(false);
      setTimeout(() => { isInitialized.current = true; }, 2000);
    }, 5000);
    return () => { clearInterval(clockTimer); clearTimeout(bootTimer); };
  }, []);

  useEffect(() => {
    let serial = urlDeviceId;
    if (!serial && typeof window !== 'undefined') serial = localStorage.getItem("pi_serial_mock");
    if (!serial) {
        serial = "PI_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        if (typeof window !== 'undefined') localStorage.setItem("pi_serial_mock", serial);
    }
    setCurrentDeviceId(serial);
  }, [urlDeviceId]);

  useEffect(() => {
    if (!currentDeviceId) return;
    const db = getDb();
    const statusRef = doc(db, "system_status", currentDeviceId);
    
    return onSnapshot(statusRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSystemStatus(data);
        if (data.userId) setCurrentUserId(data.userId);
      } else {
        setDoc(statusRef, { 
            deviceId: currentDeviceId, pairing_token: Math.floor(100000 + Math.random() * 900000).toString(), 
            status: "online", last_online: serverTimestamp(), hardware_ready: true, 
            templates_stored: 0, enrollment_status: "IDLE", scan_status: "idle"
        }, { merge: true });
      }
    });
  }, [currentDeviceId]);

  const isControllerAlive = useMemo(() => {
    if (!systemStatus?.last_online) return false;
    const lastSeen = systemStatus.last_online.toDate().getTime();
    const now = new Date().getTime();
    return (now - lastSeen) < 90000;
  }, [systemStatus]);

  // AUTO-BACK TIMERS
  useEffect(() => {
    if ((view === "success" || view === "mismatch" || view === "already-present") && currentDeviceId) {
      const timer = setTimeout(async () => {
        const db = getDb();
        await updateDoc(doc(db, "system_status", currentDeviceId), {
          scan_status: "idle", last_student_name: ""
        });
        setView("home");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [view, currentDeviceId]);

  // NAVIGATION LOGIC
  useEffect(() => {
    if (!systemStatus || !currentDeviceId || isBooting) return;

    if (!isInitialized.current) {
        if (systemStatus.userId) setView("home");
        else setView("pairing");
        return;
    }

    if (systemStatus.enrollment_status !== "IDLE" && (view === "home" || view === "enrollment-step")) {
        setView("enrollment-step");
    } else if (view === "enrollment-step" && systemStatus.enrollment_status === "IDLE") {
        setView("home");
    }

    if (view === "attendance") {
        if (systemStatus.scan_status === "success") {
            setLastStudentName(systemStatus.last_student_name || "Verified Student");
            setView("success");
        } else if (systemStatus.scan_status === "already-present") {
            setLastStudentName(systemStatus.last_student_name || "Student");
            setView("already-present");
        } else if (systemStatus.scan_status === "mismatch") {
            setView("mismatch");
        }
    }
  }, [systemStatus, view, currentDeviceId, isBooting]);

  useEffect(() => {
    if (!currentUserId) return;
    const db = getDb();
    const qStudents = collection(db, "institutes", currentUserId, "students");
    return onSnapshot(qStudents, (snap) => {
        const studentsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllStudents(studentsData);
        const classes = Array.from(new Set(studentsData.map((s: any) => s.className).filter(c => !!c))).sort() as string[];
        setAvailableClasses(classes);
        const today = format(new Date(), "yyyy-MM-dd");
        const presentToday = studentsData.filter((s: any) => s.attendance && s.attendance[today] === 'present');
        setTodayAttendance(presentToday);
    });
  }, [currentUserId]);

  const handleStartAttendance = async (className: string) => {
    if (!currentDeviceId || !currentUserId) return;
    const db = getDb();
    await updateDoc(doc(db, "system_status", currentDeviceId), { scan_status: "idle", last_student_name: "" });
    await addDoc(collection(db, "kiosk_commands"), {
        type: "START_ATTENDANCE", deviceId: currentDeviceId, userId: currentUserId, className: className, status: "pending", createdAt: serverTimestamp()
    });
    setView("attendance");
  };

  const handleBack = async () => {
    if (currentDeviceId) {
        const db = getDb();
        if (view === "attendance") {
            await addDoc(collection(db, "kiosk_commands"), {
                type: "END_ATTENDANCE", deviceId: currentDeviceId, status: "pending", createdAt: serverTimestamp()
            });
        }
        await updateDoc(doc(db, "system_status", currentDeviceId), { scan_status: "idle", last_student_name: "" });
    }
    setView("home");
  };

  const getEnrollmentDisplay = () => {
    const status = systemStatus?.enrollment_status;
    const name = systemStatus?.enrolling_student_name || "Student";
    switch(status) {
      case "PLACE_F1": return { icon: <Fingerprint className="h-64 w-64 text-primary animate-pulse" />, title: "FINGER 1", sub: `Capturing Finger 1 for ${name}`, color: "text-primary" };
      case "REMOVE_F1": return { icon: <Activity className="h-64 w-64 text-orange-500 animate-bounce" />, title: "REMOVE", sub: "Lift your first finger", color: "text-orange-500" };
      case "AGAIN_F1": return { icon: <Fingerprint className="h-64 w-64 text-indigo-500 animate-pulse" />, title: "AGAIN", sub: "Scan Finger 1 one more time", color: "text-indigo-500" };
      
      case "WAIT_F2": return { icon: <Users className="h-64 w-64 text-yellow-500 animate-pulse" />, title: "NEXT FINGER", sub: "Prepare your second finger", color: "text-yellow-500" };
      
      case "PLACE_F2": return { icon: <Fingerprint className="h-64 w-64 text-emerald-400 animate-pulse" />, title: "FINGER 2", sub: `Capturing Finger 2 for ${name}`, color: "text-emerald-400" };
      case "REMOVE_F2": return { icon: <Activity className="h-64 w-64 text-orange-500 animate-bounce" />, title: "REMOVE", sub: "Lift your second finger", color: "text-orange-500" };
      case "AGAIN_F2": return { icon: <Fingerprint className="h-64 w-64 text-indigo-500 animate-pulse" />, title: "AGAIN", sub: "Scan Finger 2 one more time", color: "text-indigo-500" };
      
      case "SUCCESS": return { icon: <CheckCircle2 className="h-64 w-64 text-emerald-500 animate-in zoom-in duration-500" />, title: "SUCCESS!", sub: `Dual registration complete for ${name}`, color: "text-emerald-500" };
      case "ERROR_F1_FAIL": return { icon: <AlertCircle className="h-64 w-64 text-rose-500" />, title: "F1 FAILED", sub: "First finger failed. Retry.", color: "text-rose-500" };
      case "ERROR_F2_FAIL": return { icon: <AlertCircle className="h-64 w-64 text-rose-500" />, title: "F2 FAILED", sub: "Second finger failed. Retry.", color: "text-rose-500" };
      default: return { icon: <Loader2 className="h-64 w-64 text-primary animate-spin" />, title: "PROCESSING", sub: "Communicating with hardware...", color: "text-primary" };
    }
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col bg-[#020617] transition-all duration-700 overflow-hidden select-none", view === "success" && "bg-emerald-950", view === "mismatch" && "bg-rose-950", view === "already-present" && "bg-amber-950")}>
      <div className="h-32 px-12 flex justify-between items-center bg-slate-900/95 border-b border-white/10 backdrop-blur-3xl z-[100] shrink-0">
        <div className="flex items-center gap-8">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <CalendarCheck className="h-14 w-14 text-primary" />
            </div>
            <span className="font-black text-6xl tracking-tighter text-white uppercase italic">BioSync <span className="text-primary">Box</span></span>
        </div>
        <div className="flex items-center gap-12">
           <div className={cn("flex items-center gap-4 px-8 py-4 rounded-[2rem] border-2 transition-all", isControllerAlive ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30")}>
              {isControllerAlive ? <Wifi className="h-8 w-8 text-emerald-500 animate-pulse" /> : <WifiOff className="h-8 w-8 text-rose-500" />}
              <span className={cn("text-2xl font-black uppercase tracking-widest", isControllerAlive ? "text-emerald-500" : "text-rose-500")}>
                {isControllerAlive ? "OS: ACTIVE" : "OS: OFFLINE"}
              </span>
           </div>
           <div className="font-mono text-5xl font-bold text-white tracking-[0.2em] bg-primary/10 px-10 py-4 rounded-[2rem] border-2 border-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
             {format(currentTime, "HH:mm")}
           </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center overflow-auto custom-scrollbar p-10">
        {(view !== "home" && view !== "processing" && view !== "pairing" && view !== "enrollment-step") && (
          <button 
            onClick={handleBack} 
            className="absolute top-10 left-10 z-[160] h-32 px-16 bg-white/10 border-4 border-white/20 rounded-[3.5rem] flex items-center gap-8 text-white transition-all active:scale-90 shadow-[0_40px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl group"
          >
            <ChevronLeft className="h-20 w-20 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-5xl font-black uppercase tracking-[0.2em]">BACK</span>
          </button>
        )}

        {view === "pairing" && (
          <div className="w-full max-w-[1200px] flex flex-col items-center justify-center space-y-16">
            <div className="relative p-20 bg-slate-900/60 rounded-[5rem] border-4 border-primary/20 shadow-2xl flex flex-col items-center gap-8">
                <Lock className="h-40 w-40 text-primary" />
                <div className="text-center space-y-4">
                    <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter">Device Locked</h2>
                    <p className="text-3xl font-bold text-slate-500 uppercase tracking-widest">Enter this code in your Dashboard</p>
                </div>
                <div className="bg-black/60 px-24 py-12 rounded-[4rem] border-4 border-primary/40 shadow-inner">
                    <span className="text-[14rem] font-black text-white tracking-[0.2em] italic leading-none text-glow-white">
                        {systemStatus?.pairing_token || "------"}
                    </span>
                </div>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="w-full h-full flex flex-col items-center justify-between py-10">
            <div className="text-center">
                <div className="text-[15rem] font-black text-white tracking-tighter italic leading-none text-glow-white">{format(currentTime, "HH:mm")}</div>
                <div className="text-5xl font-bold text-primary uppercase tracking-[0.5em] mt-10">{format(currentTime, "EEEE, MMM do")}</div>
            </div>
            <div className="flex gap-16 w-full max-w-[1600px] my-12">
                <button onClick={() => setView("class-selection")} className="group relative flex-1 h-[450px] bg-slate-900/60 border-[6px] border-white/10 hover:border-primary/50 rounded-[5rem] flex flex-col items-center justify-center gap-10 transition-all active:scale-95 shadow-2xl">
                    <div className="p-10 bg-primary/10 rounded-[3rem] border-2 border-primary/20"><Fingerprint className="h-40 w-36 text-primary" /></div>
                    <span className="text-7xl font-black text-white uppercase italic tracking-tighter">Attendance</span>
                </button>
                <button onClick={() => setView("daily-report")} className="group relative flex-1 h-[450px] bg-slate-900/60 border-[6px] border-white/10 hover:border-indigo-500/50 rounded-[5rem] flex flex-col items-center justify-center gap-10 transition-all active:scale-95 shadow-2xl">
                    <div className="p-10 bg-indigo-500/10 rounded-[3rem] border-2 border-indigo-500/20"><ClipboardList className="h-40 w-36 text-indigo-500" /></div>
                    <span className="text-7xl font-black text-white uppercase italic tracking-tighter">Live Report</span>
                </button>
            </div>
            <div className="w-full max-w-[1600px] bg-slate-900/40 border-2 border-white/10 rounded-[4rem] p-12 grid grid-cols-3 gap-16">
                <div className="flex items-center gap-8 border-r border-white/10"><Users className="h-16 w-16 text-primary" /><div className="flex flex-col"><span className="text-xl font-black text-white/30 uppercase tracking-widest">STUDENTS</span><span className="text-5xl font-bold text-white italic tracking-tighter">{allStudents.length}</span></div></div>
                <div className="flex items-center gap-8 border-r border-white/10"><Database className="h-16 w-16 text-orange-500" /><div className="flex flex-col"><span className="text-xl font-black text-white/30 uppercase tracking-widest">STORAGE</span><span className="text-5xl font-bold text-white italic tracking-tighter">{systemStatus?.templates_stored || 0}</span></div></div>
                <div className="flex items-center gap-8"><Cpu className="h-16 w-16 text-indigo-400" /><div className="flex flex-col"><span className="text-xl font-black text-white/30 uppercase tracking-widest">TEMP</span><span className="text-5xl font-bold text-white uppercase italic tracking-tighter">{systemStatus?.cpu_temp ? systemStatus.cpu_temp.toFixed(1) : "--"}°C</span></div></div>
            </div>
          </div>
        )}

        {view === "class-selection" && (
          <div className="w-full max-w-[1600px] flex flex-col items-center gap-20 py-10">
            <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter">Select Class</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 w-full px-10 overflow-y-auto max-h-[700px] custom-scrollbar">
                {availableClasses.length > 0 ? (
                    availableClasses.map((className) => (
                        <button key={className} onClick={() => handleStartAttendance(className)} className="h-56 bg-slate-900/60 border-[6px] border-white/5 hover:border-primary rounded-[4rem] flex flex-col items-center justify-center gap-4 transition-all group shadow-[0_40px_80px_rgba(0,0,0,0.5)] active:scale-90">
                            <BookOpen className="h-16 w-16 text-primary/40 group-hover:text-primary transition-colors" />
                            <span className="text-6xl font-black text-white italic uppercase tracking-tighter">{className}</span>
                        </button>
                    ))
                ) : (
                    <div className="col-span-full py-40 text-center opacity-30">
                        <Users className="h-40 w-40 mx-auto mb-10" />
                        <p className="text-5xl font-black uppercase tracking-[0.5em]">No Classes Configured</p>
                    </div>
                )}
            </div>
          </div>
        )}

        {view === "enrollment-step" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16">
            <div className="relative bg-white/5 p-20 rounded-[5rem] border-4 border-white/10 shadow-2xl">
                {getEnrollmentDisplay().icon}
            </div>
            <div className="space-y-6">
              <h1 className={cn("text-[10rem] font-black italic uppercase tracking-tighter leading-none", getEnrollmentDisplay().color)}>
                {getEnrollmentDisplay().title}
              </h1>
              <p className="text-4xl text-white/40 font-black uppercase tracking-[0.4em]">
                {getEnrollmentDisplay().sub}
              </p>
            </div>
          </div>
        )}

        {view === "attendance" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20">
            <div className="relative bg-primary/10 p-40 rounded-full border-[30px] border-primary/20 shadow-[0_0_150px_-20px_rgba(59,130,246,0.4)]">
                <Fingerprint className="h-80 w-80 text-primary animate-pulse" />
                <div className="absolute top-0 left-0 w-full h-3 bg-primary shadow-[0_0_100px_rgba(59,130,246,1)] animate-scan-line" />
            </div>
            <div className="space-y-4">
              <h1 className="text-[10rem] font-black text-white italic uppercase tracking-tighter leading-none text-glow-white">Scan Finger</h1>
              <p className="text-4xl text-primary/60 font-black uppercase tracking-[0.5em]">Fast Recognition Active</p>
            </div>
          </div>
        )}

        {view === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20 animate-in fade-in duration-500">
            <div className="bg-emerald-500 p-32 rounded-full border-[30px] border-emerald-400/40 shadow-[0_0_150px_-20px_rgba(16,185,129,0.5)] animate-in zoom-in duration-500">
              <CheckCircle2 className="h-64 w-64 text-white" />
            </div>
            <div className="space-y-10">
                <h2 className="text-[12rem] font-black text-white italic tracking-tighter uppercase leading-none">PRESENT</h2>
                <div className="bg-emerald-500/10 px-16 py-6 rounded-[3rem] border-4 border-emerald-500/30">
                  <p className="text-7xl text-emerald-300 font-black uppercase tracking-widest">{lastStudentName}</p>
                </div>
            </div>
          </div>
        )}

        {view === "already-present" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20 animate-in fade-in duration-500">
            <div className="bg-amber-500 p-32 rounded-full border-[30px] border-amber-400/40 shadow-[0_0_150px_-20px_rgba(245,158,11,0.5)] animate-in zoom-in duration-500">
              <AlertCircle className="h-64 w-64 text-white" />
            </div>
            <div className="space-y-10">
                <h2 className="text-[10rem] font-black text-white italic tracking-tighter uppercase leading-none">ALREADY MARKED</h2>
                <div className="bg-amber-500/10 px-16 py-6 rounded-[3rem] border-4 border-amber-500/30">
                  <p className="text-6xl text-amber-300 font-black uppercase tracking-widest">{lastStudentName} is already Present</p>
                </div>
                <p className="text-4xl text-amber-200/40 font-black uppercase tracking-[0.3em]">RE-SCAN NOT REQUIRED</p>
            </div>
          </div>
        )}

        {view === "mismatch" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-20 animate-in fade-in duration-500">
            <div className="bg-rose-500 p-32 rounded-full border-[30px] border-rose-400/40 shadow-[0_0_150px_-20px_rgba(244,63,94,0.5)] animate-shake">
              <XCircle className="h-64 w-64 text-white" />
            </div>
            <div className="space-y-10">
                <h2 className="text-[10rem] font-black text-white italic tracking-tighter uppercase leading-none">MISMATCH</h2>
                <p className="text-4xl text-rose-300 font-black uppercase tracking-[0.3em]">FINGER NOT RECOGNIZED</p>
            </div>
          </div>
        )}

        {view === "daily-report" && (
          <div className="w-full max-w-[1600px] h-full flex flex-col gap-12 py-10">
            <div className="flex justify-between items-end px-10">
                <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter">Live <span className="text-indigo-500">Report</span></h2>
                <div className="text-right">
                    <p className="text-xl font-black text-white/30 uppercase tracking-widest">TOTAL PRESENT TODAY</p>
                    <p className="text-7xl font-black text-indigo-500 italic">{todayAttendance.length}</p>
                </div>
            </div>
            <div className="flex-1 bg-slate-900/40 border-4 border-white/5 rounded-[5rem] overflow-hidden shadow-2xl">
                <div className="h-full overflow-y-auto custom-scrollbar p-12">
                    {todayAttendance.length > 0 ? (
                        <div className="grid grid-cols-2 gap-10">
                            {todayAttendance.map((student, idx) => (
                                <div key={student.id} className="bg-white/5 border-2 border-white/10 p-8 rounded-[3rem] flex items-center justify-between group hover:border-indigo-500/50 transition-all">
                                    <div className="flex items-center gap-8">
                                        <div className="h-20 w-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 text-3xl font-black text-indigo-500 italic">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-4xl font-black text-white italic uppercase tracking-tighter">{student.name}</p>
                                            <p className="text-xl font-bold text-white/20 uppercase tracking-widest mt-1">{student.className}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                            <UserCheck className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <p className="text-xs font-black text-emerald-500/60 mt-3 uppercase tracking-widest">VERIFIED</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 opacity-20">
                            <ClipboardList className="h-40 w-40" />
                            <p className="text-5xl font-black uppercase tracking-[0.5em]">No Records Yet</p>
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
        {view === "processing" && <div className="flex-1 flex items-center justify-center"><Loader2 className="h-64 w-64 text-primary animate-spin" /></div>}
      </div>

      <style jsx global>{`
        @keyframes scan-line { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-scan-line { animation: scan-line 4s linear infinite; }
        .text-glow-white { text-shadow: 0 0 60px rgba(255,255,255,0.4); }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out infinite; }
        .custom-scrollbar::-webkit-scrollbar { width: 20px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 6px solid #020617; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
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
