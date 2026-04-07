
"use client";

import * as React from "react";
import { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useSearchParams } from "next/navigation";
import { 
  Fingerprint, 
  CheckCircle2, 
  UserPlus, 
  Loader2,
  CalendarCheck,
  Activity,
  Users,
  Database,
  ChevronLeft,
  ShieldCheck,
  Search,
  BookOpen,
  Link as LinkIcon,
  AlertTriangle,
  XCircle,
  ClipboardList,
  PieChart,
  ArrowRight,
  TrendingUp
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
  getDocs
} from "firebase/firestore";

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
      <p className="text-primary/60 font-mono text-xl tracking-[0.8em] uppercase font-bold mb-12">OS KERNEL v13.2.PRO</p>
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
  const [view, setView] = useState<"pairing" | "home" | "attendance" | "registration" | "enrollment-step" | "success" | "processing" | "no-match" | "searching" | "class-selection" | "daily-report">("processing");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [lastStudentName, setLastStudentName] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState(0);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const { toast } = useToast();

  const [regData, setRegData] = useState({ name: "", rollNo: "", class: "", phone: "" });

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    const bootTimer = setTimeout(() => setIsBooting(false), 3000);
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
        setSystemStatus(snap.data());
      } else {
        setDoc(statusRef, { 
            deviceId: currentDeviceId, pairing_token: Math.floor(100000 + Math.random() * 900000).toString(), 
            status: "online", last_online: serverTimestamp(), hardware_ready: true, 
            templates_stored: 0, enrollment_status: "IDLE", scan_status: "idle"
        }, { merge: true });
      }
    });
  }, [currentDeviceId]);

  useEffect(() => {
    if (!systemStatus || !currentDeviceId) return;

    if (systemStatus.userId && systemStatus.userId !== currentUserId) {
        setCurrentUserId(systemStatus.userId);
    }

    if (!systemStatus.userId) {
        if (view !== "pairing") setView("pairing");
        return;
    }

    if (systemStatus.enrollment_status && systemStatus.enrollment_status !== "IDLE" && view !== "enrollment-step") {
        setView("enrollment-step");
        if (systemStatus.enrolling_student_name) {
            setRegData(prev => ({ ...prev, name: systemStatus.enrolling_student_name }));
        }
    }

    if (view === "pairing" || view === "processing") setView("home");

    if (systemStatus.enrollment_status === "SUCCESS" && view === "enrollment-step") {
        setTimeout(() => {
            setView("home");
            setRegData({ name: "", rollNo: "", class: "", phone: "" });
        }, 2500);
    }

    if ((view === "attendance" || view === "searching") && systemStatus.scan_status === "success") {
        setLastStudentName(systemStatus.last_student_name || "Unknown Student");
        setView("success");
        
        const timer = setTimeout(async () => {
            const db = getDb();
            await addDoc(collection(db, "kiosk_commands"), {
                type: "END_ATTENDANCE", deviceId: currentDeviceId, status: "pending", createdAt: serverTimestamp()
            });
            await updateDoc(doc(db, "system_status", currentDeviceId), {
                scan_status: "idle", last_student_name: ""
            });
            setView("home");
        }, 3000);
        return () => clearTimeout(timer);
    }
  }, [systemStatus, currentUserId, currentDeviceId, view]);

  useEffect(() => {
    if (!currentUserId) return;
    const db = getDb();
    const qStudents = collection(db, "institutes", currentUserId, "students");
    
    return onSnapshot(qStudents, (snap) => {
        const studentsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllStudents(studentsData);
        setStudentCount(snap.docs.length);
        const classes = Array.from(new Set(snap.docs.map(d => d.data().className).filter(c => !!c))).sort() as string[];
        setAvailableClasses(classes);
    });
  }, [currentUserId]);

  const globalStats = useMemo(() => {
    const today = format(currentTime, "yyyy-MM-dd");
    const total = allStudents.length;
    const present = allStudents.filter(s => s.attendance?.[today] === 'present').length;
    const absent = total - present;
    return { total, present, absent };
  }, [allStudents, currentTime]);

  const handleStartAttendance = async (className: string) => {
    if (!currentDeviceId || !currentUserId) return;
    try {
        const db = getDb();
        await updateDoc(doc(db, "system_status", currentDeviceId), { scan_status: "idle", last_student_name: "" });
        await addDoc(collection(db, "kiosk_commands"), {
            type: "START_ATTENDANCE", deviceId: currentDeviceId, userId: currentUserId, className: className, status: "pending", createdAt: serverTimestamp()
        });
        setView("attendance");
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Failed to trigger attendance." });
    }
  };

  const handleBack = async () => {
    if ((view === "attendance" || view === "searching" || view === "no-match" || view === "success") && currentDeviceId) {
        const db = getDb();
        await addDoc(collection(db, "kiosk_commands"), {
            type: "END_ATTENDANCE", deviceId: currentDeviceId, status: "pending", createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "system_status", currentDeviceId), { scan_status: "idle", last_student_name: "" });
    }
    setView("home");
  };

  if (isBooting) return <BootingScreen />;

  return (
    <div className={cn("fixed inset-0 flex flex-col bg-[#020617] transition-all duration-700 overflow-hidden select-none", view === "success" && "bg-emerald-950", view === "no-match" && "bg-rose-950", view === "searching" && "bg-indigo-950")}>
      <div className="h-28 px-12 flex justify-between items-center bg-slate-900/95 border-b border-white/10 backdrop-blur-3xl z-[100] shrink-0">
        <div className="flex items-center gap-8">
            <CalendarCheck className="h-14 w-14 text-primary" />
            <span className="font-black text-5xl tracking-tighter text-white uppercase italic">BioSync <span className="text-primary">Box</span></span>
        </div>
        <div className="flex items-center gap-12">
           <div className="flex items-center gap-4 bg-black/40 px-8 py-3 rounded-3xl border border-white/5">
              <div className={cn("h-4 w-4 rounded-full", systemStatus?.status === 'online' ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
              <span className="text-xl font-black text-white uppercase tracking-widest">{systemStatus?.status || "OFFLINE"}</span>
           </div>
           <div className="font-mono text-4xl font-bold text-white tracking-widest bg-primary/10 px-8 py-3 rounded-3xl border border-primary/20">
             {format(currentTime, "HH:mm")}
           </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        {(view !== "home" && view !== "processing" && view !== "pairing") && (
          <button onClick={handleBack} className="absolute top-8 left-10 z-[160] h-20 px-8 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-4 text-white transition-all active:scale-95 shadow-2xl">
            <ChevronLeft className="h-10 w-10" />
            <span className="text-xl font-black uppercase tracking-widest">BACK</span>
          </button>
        )}

        {view === "class-selection" && (
          <div className="w-full max-w-[1400px] flex flex-col items-center gap-16 animate-in fade-in duration-500">
            <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter">Select Class</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 w-full px-10">
                {availableClasses.map((className) => (
                    <button key={className} onClick={() => handleStartAttendance(className)} className="h-40 bg-slate-900/60 border-4 border-white/5 hover:border-primary rounded-[2.5rem] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-2xl group">
                        <BookOpen className="h-10 w-10 text-primary/40 group-hover:text-primary" />
                        <span className="text-5xl font-black text-white italic uppercase tracking-tighter">{className}</span>
                    </button>
                ))}
            </div>
          </div>
        )}

        {view === "daily-report" && (
          <div className="w-full max-w-[1400px] flex flex-col items-center justify-center gap-16 animate-in zoom-in duration-700">
            <div className="text-center space-y-4">
                <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter flex items-center gap-6 justify-center">
                    <TrendingUp className="h-20 w-20 text-indigo-500" />
                    LIVE <span className="text-indigo-500">REPORT</span>
                </h2>
                <p className="text-3xl font-bold text-slate-500 uppercase tracking-[0.4em] italic">Aggregate status for {format(currentTime, "MMMM do, yyyy")}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full px-20">
                <div className="bg-slate-900/60 border-4 border-white/5 rounded-[4rem] p-16 flex flex-col items-center justify-center gap-6 shadow-2xl group hover:border-indigo-500/30 transition-all">
                    <Users className="h-24 w-24 text-indigo-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="text-center">
                        <p className="text-2xl font-black text-slate-500 uppercase tracking-[0.3em] mb-2">TOTAL REGISTERED</p>
                        <p className="text-[12rem] font-black text-white italic leading-none tracking-tighter">{globalStats.total}</p>
                    </div>
                </div>

                <div className="bg-emerald-950/30 border-4 border-emerald-500/20 rounded-[4rem] p-16 flex flex-col items-center justify-center gap-6 shadow-2xl group hover:border-emerald-500/50 transition-all">
                    <CheckCircle2 className="h-24 w-24 text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="text-center">
                        <p className="text-2xl font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">PRESENT TODAY</p>
                        <p className="text-[12rem] font-black text-emerald-400 italic leading-none tracking-tighter">{globalStats.present}</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/40 border-2 border-white/10 rounded-[3rem] px-12 py-8 flex items-center gap-8 backdrop-blur-md">
                <Activity className="h-10 w-10 text-rose-500 animate-pulse" />
                <p className="text-2xl font-bold text-slate-400 uppercase tracking-widest italic">
                    <span className="text-rose-500">{globalStats.absent}</span> Registered students are currently marked absent.
                </p>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="w-full h-full flex flex-col items-center justify-between py-16 px-10 animate-in fade-in duration-700">
            <div className="text-center">
                <div className="text-[12rem] font-black text-white tracking-tighter italic leading-none text-glow-white">{format(currentTime, "HH:mm")}</div>
                <div className="text-4xl font-bold text-primary uppercase tracking-[0.4em] mt-8">{format(currentTime, "EEEE, MMM do")}</div>
            </div>
            <div className="flex gap-12 w-full max-w-[1400px]">
                <button onClick={() => setView("class-selection")} className="group relative flex-1 h-[350px] bg-slate-900/60 border-4 border-white/10 hover:border-primary/50 rounded-[4rem] flex flex-col items-center justify-center gap-8 transition-all active:scale-95 shadow-2xl">
                    <div className="p-8 bg-primary/10 rounded-full border border-primary/20"><Fingerprint className="h-32 w-28 text-primary drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]" /></div>
                    <span className="text-6xl font-black text-white uppercase italic tracking-tighter">Attendance</span>
                </button>
                <button onClick={() => setView("daily-report")} className="group relative flex-1 h-[350px] bg-slate-900/60 border-4 border-white/10 hover:border-indigo-500/50 rounded-[4rem] flex flex-col items-center justify-center gap-8 transition-all active:scale-95 shadow-2xl">
                    <div className="p-8 bg-indigo-500/10 rounded-full border border-indigo-500/20"><ClipboardList className="h-32 w-28 text-indigo-500 drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]" /></div>
                    <span className="text-6xl font-black text-white uppercase italic tracking-tighter">Live Report</span>
                </button>
            </div>
            <div className="w-full max-w-[1400px] bg-slate-900/40 border-2 border-white/10 rounded-[3rem] p-10 grid grid-cols-3 gap-12 backdrop-blur-md">
                <div className="flex items-center gap-6 border-r border-white/10"><Users className="h-12 w-12 text-primary" /><div className="flex flex-col"><span className="text-lg font-black text-white/30 uppercase">STUDENTS</span><span className="text-3xl font-bold text-white">{studentCount}</span></div></div>
                <div className="flex items-center gap-6 border-r border-white/10"><Database className="h-12 w-12 text-orange-500" /><div className="flex flex-col"><span className="text-lg font-black text-white/30 uppercase">STORAGE</span><span className="text-3xl font-bold text-white">{systemStatus?.templates_stored || 0}</span></div></div>
                <div className="flex items-center gap-6"><Activity className="h-12 w-12 text-indigo-400" /><div className="flex flex-col"><span className="text-lg font-black text-white/30 uppercase">ENGINE</span><span className="text-2xl font-bold text-indigo-400 uppercase italic">v13.2 PRO</span></div></div>
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
            <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter">Scan Finger</h1>
          </div>
        )}

        {view === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in zoom-in duration-700">
            <div className="bg-emerald-500 p-24 rounded-full scale-110 shadow-[0_0_150px_rgba(16,185,129,0.6)] border-[20px] border-emerald-400/40"><CheckCircle2 className="h-48 w-48 text-white" /></div>
            <div className="space-y-8">
                <h2 className="text-9xl font-black text-white italic tracking-tighter uppercase">PRESENT</h2>
                <p className="text-6xl text-emerald-300 font-black uppercase tracking-widest">{lastStudentName}</p>
            </div>
          </div>
        )}

        {view === "enrollment-step" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-16 animate-in fade-in zoom-in duration-700">
                <div className="relative p-16 bg-emerald-500/10 rounded-full border-[15px] border-emerald-500/20 shadow-2xl"><Fingerprint className="h-48 w-48 text-emerald-500 animate-pulse" /></div>
                <div className="space-y-10">
                    <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{regData.name || systemStatus?.enrolling_student_name || "Enrolling..."}</h1>
                    <div className={cn(
                        "text-5xl font-mono tracking-[0.2em] font-black px-16 py-8 rounded-[3rem] border-4 shadow-2xl bg-emerald-500/10 border-emerald-500/30",
                        systemStatus?.enrollment_status === 'SUCCESS' ? "text-emerald-400 border-emerald-400" : "text-emerald-400 animate-pulse"
                    )}>
                        {systemStatus?.enrollment_status || "INITIALIZING..."}
                    </div>
                </div>
            </div>
        )}

        {view === "processing" && <div className="flex-1 flex items-center justify-center"><Loader2 className="h-48 w-48 text-primary animate-spin" /></div>}
      </div>

      <style jsx global>{`
        @keyframes scan-line { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        .animate-scan-line { animation: scan-line 4s linear infinite; }
        .text-glow-white { text-shadow: 0 0 40px rgba(255,255,255,0.4); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
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
