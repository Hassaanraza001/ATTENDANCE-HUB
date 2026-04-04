
"use client";

import * as React from "react";
import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Student, Faculty, UserProfile } from "@/lib/types";
import { 
  updateStudentsAttendance, deleteStudent, addStudent, updateStudent,
  getFaculties, getUserProfile, updateUserProfile
} from "@/services/firestore";
import { format } from "date-fns";
import { getAuthInstance, getDb } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, limit, doc, getDoc, setDoc } from "firebase/firestore";

import { Header } from "@/components/layout/header";
import { AttendanceControls } from "@/components/dashboard/attendance-controls";
import { StudentTable } from "@/components/dashboard/student-table";
import { AddStudentDialog } from "@/components/dashboard/add-student-dialog";
import { EditStudentDialog } from "@/components/dashboard/edit-student-dialog";
import { AttendanceCalendarDialog } from "@/components/dashboard/attendance-calendar-dialog";
import { AttendanceReportDialog } from "@/components/dashboard/attendance-report-dialog";
import { DeleteStudentAlert } from "@/components/dashboard/delete-student-alert";
import { ManageFacultyDialog } from "@/components/dashboard/manage-faculty-dialog";
import { DeviceCenterDialog } from "@/components/dashboard/hardware-management-dialog";
import { HistoryAuditDialog } from "@/components/dashboard/history-audit-dialog";
import { ProfileSettingsDialog } from "@/components/dashboard/profile-settings-dialog";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  ShieldCheck, 
  Activity, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Database, 
  CalendarDays,
  Waves,
  Sparkles,
  Filter,
  History,
  Terminal,
  Signal,
  BrainCircuit,
  BellRing,
  CalendarCheck,
  ChevronLeft,
  BookOpen,
  Clock,
  Search,
  Cpu
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import Link from "next/link";
import { cn } from "@/lib/utils";

type AppState = "idle" | "attending" | "enrolling";
type AttendanceType = "biometric" | "manual";

const BootingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  
  const logs = [
    "Establishing Secure Link...",
    "Handshaking with BioSync Hardware...",
    "Syncing Institution Roster...",
    "Calibrating Biometric Engine...",
    "Initializing Forensic Audit Logs...",
    "OS Kernel v2.8.5.PRO Active",
    "Welcome to Attendance HUB"
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 1));
    }, 30);

    const logInterval = setInterval(() => {
      setLogIndex((prev) => (prev < logs.length - 1 ? prev + 1 : prev));
    }, 600);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[200] overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-10 group">
          <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse-slow scale-150" />
          <div className="relative p-10 bg-slate-900/60 rounded-[2.5rem] border border-primary/20 shadow-[0_0_60px_-15px_rgba(59,130,246,0.5)]">
            <CalendarCheck className="h-24 w-24 text-primary animate-bounce-slow" />
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl shadow-lg border border-white/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="text-center space-y-2 mb-10">
          <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none text-glow-white">
            Attendance <span className="text-primary">HUB</span>
          </h1>
          <p className="text-primary/60 font-mono text-[10px] tracking-[0.8em] uppercase font-bold">BioSync OS Terminal</p>
        </div>

        <div className="w-80 space-y-6">
          <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div 
              className="h-full bg-primary shadow-[0_0_20px_rgba(59,130,246,1)] transition-all duration-300 rounded-full" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          
          <div className="h-12 flex flex-col items-center justify-center">
            <div className="flex items-center gap-3 text-emerald-400/80 font-mono text-[11px] font-black italic">
              <Terminal className="h-3 w-3" />
              <span className="uppercase tracking-widest">{logs[logIndex]}</span>
            </div>
            <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em] mt-2">SYSTEM SYNCING {progress}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // STATES
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [appState, setAppState] = useState<AppState>("idle");
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("biometric");
  
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isFacultyDialogOpen, setIsFacultyDialogOpen] = useState(false);
  const [isDeviceCenterOpen, setIsDeviceCenterOpen] = useState(false);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [isHistoryAuditOpen, setIsHistoryAuditOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  
  const [studentToEnroll, setStudentToEnroll] = useState<Student | null>(null);
  const [selectedStudentForCalendar, setSelectedStudentForCalendar] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [lastMarkedStudent, setLastMarkedStudent] = useState<string | null>(null);

  const auth = getAuthInstance();
  const db = getDb();

  // CALLBACKS
  const fetchFaculty = useCallback(async (userId: string) => {
    try {
      const facultiesFromDB = await getFaculties(userId);
      setFaculties(facultiesFromDB);
    } catch (error) {
      console.error("Error fetching faculty:", error);
    }
  }, []);

  const initProfile = useCallback(async (userId: string) => {
    try {
      const docRef = doc(db, "institutes", userId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const initialProfile = {
          displayName: "Admin User",
          instituteName: "Command Center",
          phoneNumber: "",
          email: auth.currentUser?.email || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(docRef, initialProfile);
      }
    } catch (error) {
      console.error("Profile Init Error:", error);
    }
  }, [auth, db]);

  // MAIN AUTH & DATA SYNC EFFECT
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await initProfile(user.uid);
        await fetchFaculty(user.uid);
        
        // Live Profile Sync
        const profileUnsub = onSnapshot(doc(db, "institutes", user.uid), (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
          }
        });

        // Live Device Status Sync
        const qStatus = query(collection(db, "system_status"), where("userId", "==", user.uid), limit(1));
        const statusUnsub = onSnapshot(qStatus, (snap) => {
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setDeviceStatus(data);
            if (data.scan_status === "success") {
                setLastMarkedStudent(data.last_student_name);
            }
          } else {
            setDeviceStatus(null);
          }
        });

        // Live Students Sync
        const qStudents = collection(db, "institutes", user.uid, "students");
        const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
          const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
          setAllStudents(studentsData);
          setIsLoading(false); 
        }, (err) => {
          console.error("Students sync error:", err);
          setIsLoading(false);
        });

        return () => {
          unsubscribeStudents();
          statusUnsub();
          profileUnsub();
        };
      } else {
        setIsLoading(false);
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router, auth, db, fetchFaculty, initProfile]);

  // MEMOIZED VALUES
  const students = useMemo(() => {
    if (!currentUser) return [];
    const dateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    return allStudents.map(student => ({
      ...student,
      status: (student.attendance && student.attendance[dateKey]) || null
    }));
  }, [allStudents, currentUser, selectedDate]);

  const classStats = useMemo(() => {
    const total = students.length;
    const present = students.filter(s => s.status === 'present').length;
    const absent = students.filter(s => s.status === 'absent').length;
    return { total, present, absent };
  }, [students]);

  const classNames = useMemo(() => {
    return [...new Set(allStudents.map(s => s.className).filter(name => !!name && name.trim() !== ''))].sort();
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    let studentsByClass = students;
    if (selectedClass !== "All") {
      studentsByClass = students.filter(s => s.className === selectedClass);
    }
    if (!searchQuery) return studentsByClass;
    return studentsByClass.filter(s => 
      s.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNo?.toString().includes(searchQuery)
    );
  }, [students, selectedClass, searchQuery]);

  // HANDLERS
  const handleStartAttendance = async (type: AttendanceType) => {
    if (!deviceStatus?.deviceId) {
        toast({ variant: "destructive", title: "No Hardware Linked", description: "Link your BioSync Box first." });
        return;
    }
    setAttendanceType(type);
    setAppState("attending");
    if (type === 'biometric' && currentUser) {
      await addDoc(collection(db, "kiosk_commands"), {
        type: "START_ATTENDANCE", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
    toast({ title: "Attendance Session Started" });
  };

  const handleEndAttendance = async () => {
    if (!currentUser || !deviceStatus?.deviceId) return;
    setAppState("idle");
    if (attendanceType === 'biometric') {
      await addDoc(collection(db, "kiosk_commands"), {
        type: "END_ATTENDANCE", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
    toast({ title: "Session Closed" });
  };

  const handleResetSensor = async () => {
    if (!currentUser || !deviceStatus?.deviceId) {
      toast({ variant: "destructive", title: "Error", description: "No device linked to reset." });
      return;
    }
    try {
      await addDoc(collection(db, "kiosk_commands"), {
        type: "RESET_SENSOR", 
        deviceId: deviceStatus.deviceId, 
        userId: currentUser.uid, 
        status: "pending", 
        createdAt: serverTimestamp()
      });
      toast({ title: "Reset Command Sent", description: "The local template database is being wiped..." });
    } catch (e) {
      toast({ variant: "destructive", title: "Reset Failed" });
    }
  };

  const handleManualMark = (id: string, status: 'present' | 'absent') => {
    if (!currentUser) return;
    const dateKey = format(selectedDate || new Date(), "yyyy-MM-dd");
    const student = allStudents.find(s => s.id === id);
    if (student) {
      const newAttendance = { ...student.attendance, [dateKey]: status };
      startTransition(() => {
        updateStudent(currentUser.uid, id, { attendance: newAttendance });
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete || !currentUser) return;
    try {
        // 1. Delete from Firestore
        await deleteStudent(currentUser.uid, studentToDelete.id);
        // 2. Command Pi to delete from local storage
        if (deviceStatus?.deviceId) {
            await addDoc(collection(db, "kiosk_commands"), {
                type: "DELETE_TEMPLATE",
                studentId: studentToDelete.id,
                deviceId: deviceStatus.deviceId,
                status: "pending",
                createdAt: serverTimestamp()
            });
        }
        setStudentToDelete(null);
        toast({ title: "Student Record Purged" });
    } catch (e) {
        toast({ variant: "destructive", title: "Deletion Failed" });
    }
  };

  const isDeviceOnline = deviceStatus && (new Date().getTime() - (deviceStatus.last_online?.toDate().getTime() || 0) < 60000);

  if (isLoading) {
    return <BootingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background selection:bg-primary/30">
      <Header 
        userEmail={currentUser?.email} 
        userName={userProfile?.displayName} 
        onProfileClick={() => setIsProfileDialogOpen(true)}
        onResetSensor={handleResetSensor}
      >
        <div className="flex items-center gap-4">
          <Link href={`/kiosk?deviceId=${deviceStatus?.deviceId || ''}`} target="_blank">
            <Button variant="outline" size="sm" className="hidden md:flex border-primary/40 text-primary hover:bg-primary hover:text-white rounded-2xl font-black italic uppercase tracking-tighter px-6 h-9 transition-all group">
              <ExternalLink className="mr-2 h-4 w-4 transition-transform group-hover:rotate-45" /> Preview Kiosk
            </Button>
          </Link>
          <Button 
            variant={isDeviceOnline ? "success" : "destructive"} 
            size="sm" 
            className={cn(
              "hidden md:flex font-black tracking-tighter italic uppercase rounded-2xl border-none transition-all px-6 h-9",
              isDeviceOnline ? "shadow-[0_0_25px_rgba(34,197,94,0.4)]" : "opacity-70"
            )}
            onClick={() => setIsDeviceCenterOpen(true)}
          >
            {isDeviceOnline ? <Activity className="mr-2 h-4 w-4 animate-pulse" /> : <Activity className="mr-2 h-4 w-4" />}
            {isDeviceOnline ? `${deviceStatus?.cpu_temp?.toFixed(1) || '38'}°C` : "OFFLINE"}
          </Button>
        </div>
      </Header>
      
      <main className="flex-1 container mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in zoom-in duration-700">
          <div className="md:col-span-8 flex items-center gap-4 bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-4">
             <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <Signal className="h-5 w-5 text-emerald-500 animate-pulse" />
                </div>
                <div>
                   <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">DATABASE SYNC</p>
                   <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">LIVE <Waves className="h-2 w-2 animate-pulse" /></p>
                </div>
             </div>
             <div className="flex-1 flex items-center gap-3 bg-black/40 px-4 py-3 rounded-xl border border-white/5 overflow-hidden">
                <Terminal className="h-4 w-4 text-primary animate-pulse shrink-0" />
                <div className="text-[11px] font-mono text-primary/60 truncate whitespace-nowrap">
                   [SYSTEM_LOG]: Hybrid Engine Active... Matching Local Templates... {lastMarkedStudent ? `Last Sync: ${lastMarkedStudent} marked present` : ''}
                </div>
             </div>
          </div>
          <div className="md:col-span-4 flex items-center justify-between bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-4">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">LOCAL TIME</p>
                  <span className="text-sm font-black text-white italic tracking-tighter uppercase">{format(new Date(), "HH:mm:ss")}</span>
                </div>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">UPTIME</span>
                <span className="text-[11px] font-bold text-white/60">14d 05h 22m</span>
             </div>
          </div>
        </div>

        <div className="relative bg-slate-900/30 rounded-[3rem] border border-white/5 p-10 overflow-hidden min-h-[300px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -mr-64 -mt-64" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] -ml-32 -mb-32" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-3 text-primary bg-primary/10 w-fit px-4 py-1 rounded-full border border-primary/20">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Command Hub v11 HYBRID</span>
              </div>
              <h2 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-glow-white">
                {userProfile?.instituteName?.split(' ')[0] || "COMMAND"} <span className="text-primary">{userProfile?.instituteName?.split(' ').slice(1).join(' ') || "CENTER"}</span>
              </h2>
              <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                 <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                    Authorized Terminal: <span className="text-white">{userProfile?.displayName || currentUser?.email}</span>
                 </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6">
               {lastMarkedStudent && (
                 <div className="flex flex-col items-center animate-in zoom-in duration-500">
                    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                       <BellRing className="h-5 w-5 text-emerald-500 animate-bounce" />
                       <span className="text-xs font-black text-white uppercase italic tracking-tighter">
                          <span className="text-emerald-500">{lastMarkedStudent}</span> Marked Present
                       </span>
                    </div>
                    <div className="h-10 w-[2px] bg-gradient-to-b from-emerald-500/50 to-transparent" />
                 </div>
               )}
               
               <div className="group relative">
                  <Button 
                    variant="outline" 
                    className="h-14 px-8 bg-white/5 border-white/10 rounded-2xl flex items-center gap-3 hover:bg-primary hover:border-primary transition-all group overflow-hidden"
                  >
                    <BrainCircuit className="h-5 w-5 text-primary group-hover:text-white transition-colors" />
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-1 group-hover:text-white/60">HYBRID ENGINE</span>
                      <span className="text-sm font-black italic uppercase tracking-tighter text-white">Unlimited Storage</span>
                    </div>
                  </Button>
               </div>
            </div>

            <div className="flex flex-col items-end gap-4 bg-slate-900/50 p-4 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center gap-3 bg-white/5 px-6 py-2.5 rounded-2xl border border-white/10 hover:border-primary/30 transition-all cursor-pointer group">
                 <CalendarDays className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
                   {selectedDate ? format(selectedDate, "MMMM do, yyyy") : "Pick Date"}
                 </span>
              </div>
              <AttendanceControls
                appState={appState}
                onStartAttendanceClick={handleStartAttendance}
                onEndAttendanceClick={handleEndAttendance}
                compact
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="glass-card p-8 flex items-center justify-between border-primary/20 bg-primary/5 group relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2">DB Population</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-glow-primary">{classStats.total}</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase">Verified Students</p>
            </div>
            <Users className="h-16 w-16 text-primary/10 group-hover:text-primary/30 group-hover:scale-110 transition-all relative z-10" />
          </Card>
          
          <Card className="glass-card p-8 flex items-center justify-between border-emerald-500/20 bg-emerald-500/5 group relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">Live Presence</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-glow-emerald">{classStats.present}</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase">Marked Present</p>
            </div>
            <CheckCircle2 className="h-16 w-16 text-emerald-500/10 group-hover:text-emerald-500/30 group-hover:scale-110 transition-all relative z-10" />
          </Card>

          <Card className="glass-card p-8 flex items-center justify-between border-rose-500/20 bg-rose-500/5 group relative overflow-hidden rounded-[2.5rem]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] mb-2">Critical Absence</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-glow-rose">{classStats.absent}</h3>
              <p className="text-xs font-bold text-muted-foreground uppercase">Missing Records</p>
            </div>
            <XCircle className="h-16 w-16 text-rose-500/10 group-hover:text-rose-500/30 group-hover:scale-110 transition-all relative z-10" />
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-4 pb-20">
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="glass-card group cursor-pointer hover:border-primary/50 rounded-[3rem] p-10 space-y-6 overflow-hidden relative border-white/5" onClick={() => setIsRosterDialogOpen(true)}>
                <div className="p-6 bg-primary/10 rounded-3xl w-fit border border-primary/20"><Database className="h-10 w-10 text-primary" /></div>
                <div><h3 className="text-3xl font-black italic uppercase tracking-tighter">Student <span className="text-primary">Console</span></h3></div>
                <Button variant="outline" className="w-full border-primary/30 text-primary rounded-2xl h-12 font-black italic uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-white transition-all">Launch Console</Button>
              </Card>

              <Card className="glass-card group cursor-pointer hover:border-indigo-500/50 rounded-[3rem] p-10 space-y-6 overflow-hidden relative border-white/5" onClick={() => setIsReportDialogOpen(true)}>
                <div className="p-6 bg-indigo-500/10 rounded-3xl w-fit border border-indigo-500/20"><BookOpen className="h-10 w-10 text-indigo-500" /></div>
                <div><h3 className="text-3xl font-black italic uppercase tracking-tighter">Report <span className="text-indigo-500">Center</span></h3></div>
                <Button variant="outline" className="w-full border-indigo-500/30 text-indigo-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-indigo-500/5 hover:bg-indigo-500 hover:text-white transition-all">View Analytics</Button>
              </Card>

              <Card className="glass-card group cursor-pointer hover:border-orange-500/50 rounded-[3rem] p-10 space-y-6 overflow-hidden relative border-white/5" onClick={() => setIsFacultyDialogOpen(true)}>
                <div className="p-6 bg-orange-500/10 rounded-3xl w-fit border border-orange-500/20"><Users className="h-10 w-10 text-orange-500" /></div>
                <div><h3 className="text-3xl font-black italic uppercase tracking-tighter">Faculty <span className="text-orange-500">Node</span></h3></div>
                <Button variant="outline" className="w-full border-orange-500/30 text-orange-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-orange-500/5 hover:bg-orange-500 hover:text-white transition-all">Modify Access</Button>
              </Card>

              <Card className="glass-card group cursor-pointer hover:border-emerald-500/50 rounded-[3rem] p-10 space-y-6 overflow-hidden relative border-white/5" onClick={() => setIsHistoryAuditOpen(true)}>
                <div className="p-6 bg-emerald-500/10 rounded-3xl w-fit border border-emerald-500/20"><History className="h-10 w-10 text-emerald-500" /></div>
                <div><h3 className="text-3xl font-black italic uppercase tracking-tighter">History <span className="text-emerald-500">Audit</span></h3></div>
                <Button variant="outline" className="w-full border-emerald-500/30 text-emerald-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-emerald-500/5 hover:bg-emerald-500 hover:text-white transition-all">Search Records</Button>
              </Card>
            </div>
          </div>

          <div className="space-y-8">
            <Card className="glass-card group cursor-pointer hover:border-primary/40 rounded-[3rem] p-10 space-y-10 border-white/5" onClick={() => setIsDeviceCenterOpen(true)}>
                <div className="flex justify-between items-start">
                  <div className={cn("p-6 rounded-3xl border transition-all", isDeviceOnline ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted")}><Cpu className={cn("h-10 w-10", isDeviceOnline ? "text-emerald-500" : "text-muted-foreground")} /></div>
                  <div className={cn("h-3 w-3 rounded-full", isDeviceOnline ? "bg-emerald-500" : "bg-rose-500")} />
                </div>
                <h3 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Device <span className="text-primary">Center</span></h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black text-muted-foreground uppercase">STORAGE</span>
                      <span className="text-sm font-black text-white">{isDeviceOnline ? `${deviceStatus?.templates_stored || 0} Files` : "--"}</span>
                  </div>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black italic uppercase tracking-widest rounded-2xl py-8 shadow-xl">Open OS Terminal</Button>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={isRosterDialogOpen} onOpenChange={setIsRosterDialogOpen}>
        <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 rounded-none">
          <DialogHeader className="px-10 pt-24 pb-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl shrink-0">
            <button onClick={() => setIsRosterDialogOpen(false)} className="absolute top-8 left-8 h-10 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2 text-white/60"><ChevronLeft className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-widest">BACK</span></button>
            <div className="flex items-center justify-between pt-4">
              <div>
                <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase text-white">STUDENT <span className="text-primary">ROSTER</span></DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">Manage institution-wide student records.</DialogDescription>
              </div>
              <div className="flex items-center gap-4">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-[200px] h-12 bg-slate-900/80 border-white/10 text-white font-black italic uppercase"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="All">All Classes</SelectItem>
                      {classNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="bg-primary hover:bg-primary/90 font-black italic uppercase h-12 px-8 rounded-2xl shadow-xl" onClick={() => setIsAddStudentDialogOpen(true)}><Users className="mr-2 h-5 w-5" /> Enroll Student</Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-10 py-10">
             <StudentTable
                students={filteredStudents}
                attendanceMode={appState === "attending"}
                attendanceType={attendanceType}
                onManualMark={handleManualMark}
                onViewHistory={setSelectedStudentForCalendar}
                onEdit={setStudentToEdit}
                onDelete={setStudentToDelete}
                onEnroll={setStudentToEnroll}
                isLoading={false}
                selectedDate={selectedDate}
                onSendNotifications={() => {}}
                attendanceTaken={appState === "attending"}
                isPending={isPending}
              />
          </div>
        </DialogContent>
      </Dialog>

      <AddStudentDialog 
        isOpen={isAddStudentDialogOpen} 
        onOpenChange={setIsAddStudentDialogOpen} 
        onStudentAdded={async (d) => {
          if (!currentUser) return null;
          const sId = await addStudent(currentUser.uid, {...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'});
          const finalStudent = {id: sId, ...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'};
          setStudentToEnroll(finalStudent);
          return finalStudent;
        }} 
        isAdding={isPending} 
        allStudents={allStudents} 
        studentToEnroll={studentToEnroll} 
        onEnroll={(s) => {
           addDoc(collection(db, "kiosk_commands"), {
            type: "ENROLL", studentId: s.id, studentName: s.name, deviceId: deviceStatus?.deviceId, status: "pending", createdAt: serverTimestamp(), userId: currentUser?.uid
          });
          setAppState("enrolling");
        }} 
        enrollmentStatus={deviceStatus?.enrollment_status} 
        arduinoStatus={{ connected: isDeviceOnline || false, message: isDeviceOnline ? "Device Online" : "Device Offline" }} 
        appState={appState} 
      />
      
      <EditStudentDialog 
        student={studentToEdit} 
        isOpen={!!studentToEdit} 
        onOpenChange={() => setStudentToEdit(null)} 
        onStudentUpdated={(s) => currentUser && updateStudent(currentUser.uid, s.id, s)} 
        isUpdating={isPending} 
      />
      <AttendanceCalendarDialog student={selectedStudentForCalendar} isOpen={!!selectedStudentForCalendar} onOpenChange={() => setSelectedStudentForCalendar(null)} />
      <AttendanceReportDialog isOpen={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} students={allStudents} classNames={classNames} />
      <DeleteStudentAlert isOpen={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)} onConfirm={handleConfirmDelete} studentName={studentToDelete?.name} isDeleting={isPending} />
      <ManageFacultyDialog isOpen={isFacultyDialogOpen} onOpenChange={setIsFacultyDialogOpen} faculties={faculties} onRefresh={() => currentUser && fetchFaculty(currentUser.uid)} userId={currentUser?.uid || ''} />
      <DeviceCenterDialog isOpen={isDeviceCenterOpen} onOpenChange={setIsDeviceCenterOpen} userId={currentUser?.uid || ''} />
      <HistoryAuditDialog isOpen={isHistoryAuditOpen} onOpenChange={setIsHistoryAuditOpen} students={allStudents} classNames={classNames} onViewProfile={setSelectedStudentForCalendar} />
      <ProfileSettingsDialog isOpen={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} profile={userProfile} onRefresh={() => currentUser && initProfile(currentUser.uid)} />
      
      <style jsx global>{`
        .text-glow-emerald { text-shadow: 0 0 25px rgba(16,185,129,0.5); }
        .text-glow-rose { text-shadow: 0 0 25px rgba(244,63,94,0.5); }
        .animate-bounce-slow { animation: bounce 3s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </div>
  );
}
