
"use client";

import * as React from "react";
import { useState, useTransition, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Student, Faculty, UserProfile } from "@/lib/types";
import { 
  deleteStudent, addStudent, updateStudent,
  getFaculties
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
import { Input } from "@/components/ui/input";
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
  History,
  Terminal,
  Signal,
  BrainCircuit,
  BellRing,
  CalendarCheck,
  ChevronLeft,
  BookOpen,
  Clock,
  Cpu,
  Smartphone,
  Search,
  Filter
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
  
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 1));
    }, 20);
    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#020617] flex flex-col items-center justify-center z-[9999] overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px] animate-pulse" />
      
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="relative p-10 bg-slate-900/60 rounded-[3rem] border border-primary/20 shadow-[0_0_60px_-15px_rgba(59,130,246,0.5)] mb-10">
          <Smartphone className="h-20 w-20 text-primary animate-pulse" />
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-xl shadow-lg border-2 border-[#020617]">
             <Activity className="h-4 w-4 text-white animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-2 mb-10">
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none text-glow-white">
            APP <span className="text-primary">SYNCING...</span>
          </h1>
          <p className="text-primary/40 font-mono text-[9px] tracking-[0.5em] uppercase font-bold">SECURE MOBILE NODE CONNECTED</p>
        </div>

        <div className="w-64 space-y-4">
          <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
            <div 
              className="h-full bg-primary shadow-[0_0_15px_rgba(59,130,246,1)] transition-all duration-300 rounded-full" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-black italic">
               <div className="h-1  w-1 rounded-full bg-emerald-500 animate-ping" />
               SYSTEM INITIALIZED
            </div>
            <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">{progress}% LOADED</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AndroidAppPage() {
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setIsLoading(false);
        router.push("/login");
      }
    });
    return unsub;
  }, [auth, router]);

  // RESET appState when hardware returns to IDLE
  useEffect(() => {
    if (deviceStatus?.enrollment_status === "IDLE" && appState === "enrolling") {
      setAppState("idle");
    }
  }, [deviceStatus?.enrollment_status, appState]);

  useEffect(() => {
    if (!currentUser) return;
    const initData = async () => {
        try {
            const docRef = doc(db, "institutes", currentUser.uid);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                await setDoc(docRef, {
                    displayName: "Admin User", instituteName: "Command Center", email: currentUser.email || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
            }
            const facultiesFromDB = await getFaculties(currentUser.uid);
            setFaculties(facultiesFromDB);
        } catch (e) { console.error(e); }
    };
    initData();
  }, [currentUser, db]);

  useEffect(() => {
    if (!currentUser) return;
    return onSnapshot(doc(db, "institutes", currentUser.uid), (snap) => {
      if (snap.exists()) setUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
    });
  }, [currentUser?.uid, db]);

  useEffect(() => {
    if (!currentUser) return;
    const qStatus = query(collection(db, "system_status"), where("userId", "==", currentUser.uid), limit(1));
    return onSnapshot(qStatus, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setDeviceStatus(data);
        if (data.scan_status === "success") setLastMarkedStudent(data.last_student_name);
      }
    });
  }, [currentUser?.uid, db]);

  useEffect(() => {
    if (!currentUser) return;
    const qStudents = collection(db, "institutes", currentUser.uid, "students");
    return onSnapshot(qStudents, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setAllStudents(studentsData);
      setIsLoading(false); 
    });
  }, [currentUser?.uid, db]);

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
    return [...new Set(allStudents.map(s => s.className).filter(name => !!name))].sort();
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    let studentsByClass = students;
    if (selectedClass !== "All") studentsByClass = students.filter(s => s.className === selectedClass);
    if (!searchQuery) return studentsByClass;
    return studentsByClass.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.rollNo?.toString().includes(searchQuery));
  }, [students, selectedClass, searchQuery]);

  const handleStartAttendance = async (type: AttendanceType) => {
    if (!deviceStatus?.deviceId) {
        toast({ variant: "destructive", title: "No Box Linked" });
        return;
    }
    setAttendanceType(type);
    setAppState("attending");
    if (type === 'biometric' && currentUser) {
      await addDoc(collection(db, "kiosk_commands"), {
        type: "START_ATTENDANCE", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
  };

  const handleEndAttendance = async () => {
    if (!currentUser || !deviceStatus?.deviceId) return;
    setAppState("idle");
    if (attendanceType === 'biometric') {
      await addDoc(collection(db, "kiosk_commands"), {
        type: "END_ATTENDANCE", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
  };

  const isDeviceOnline = deviceStatus && (new Date().getTime() - (deviceStatus.last_online?.toDate().getTime() || 0) < 60000);

  if (isLoading) return <BootingScreen />;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <Header 
        userEmail={currentUser?.email} 
        userName={userProfile?.displayName} 
        onProfileClick={() => setIsProfileDialogOpen(true)}
      >
        <div className="flex items-center gap-2">
          <Link href={`/kiosk?deviceId=${deviceStatus?.deviceId || ''}`} target="_blank">
            <Button variant="outline" size="sm" className="flex border-primary/40 text-primary rounded-xl font-black italic uppercase text-[10px] h-8 px-3">
              <ExternalLink className="mr-1 h-3 w-3" /> Kiosk
            </Button>
          </Link>
          <Button 
            variant={isDeviceOnline ? "success" : "destructive"} 
            size="sm" 
            className={cn("flex font-black text-[10px] uppercase rounded-xl h-8 px-3 border-none shadow-lg", isDeviceOnline && "shadow-emerald-500/20")}
            onClick={() => setIsDeviceCenterOpen(true)}
          >
            <Activity className="mr-1 h-3 w-3" /> {isDeviceOnline ? "LIVE" : "OFF"}
          </Button>
        </div>
      </Header>
      
      <main className="flex-1 px-4 py-6 space-y-6">
        
        <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5 overflow-hidden">
            <Terminal className="h-3 w-3 text-primary animate-pulse shrink-0" />
            <div className="text-[10px] font-mono text-primary/60 truncate uppercase">
               App Mode: {isDeviceOnline ? 'Hardware Connected' : 'Hardware Offline'}
            </div>
        </div>

        <div className="relative bg-slate-900/30 rounded-[3rem] border border-white/5 p-6 overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-primary bg-primary/10 w-fit px-3 py-0.5 rounded-full border border-primary/20">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest">Mobile Terminal</span>
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-tight text-glow-white">
              {userProfile?.instituteName || "COMMAND CENTER"}
            </h2>
            
            <div className="flex items-center gap-2 py-4 border-t border-white/5 mt-4">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
               <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                  Admin: <span className="text-white">{userProfile?.displayName || "SuperUser"}</span>
               </p>
            </div>

            <div className="pt-2">
              <AttendanceControls
                appState={appState}
                onStartAttendanceClick={handleStartAttendance}
                onEndAttendanceClick={handleEndAttendance}
                compact
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card className="glass-card p-6 flex items-center justify-between border-primary/20 bg-primary/5 rounded-3xl">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-primary uppercase tracking-widest">Database</p>
              <h3 className="text-4xl font-black italic tracking-tighter text-white">{classStats.total}</h3>
              <p className="text-[9px] font-bold text-muted-foreground uppercase">Verified Nodes</p>
            </div>
            <Users className="h-10 w-10 text-primary/20" />
          </Card>
          
          <div className="grid grid-cols-2 gap-4">
              <Card className="glass-card p-5 flex flex-col justify-between border-emerald-500/20 bg-emerald-500/5 rounded-3xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-500/40 mb-3" />
                <div>
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Present</p>
                  <h3 className="text-3xl font-black italic text-white">{classStats.present}</h3>
                </div>
              </Card>
              <Card className="glass-card p-5 flex flex-col justify-between border-rose-500/20 bg-rose-500/5 rounded-3xl">
                <XCircle className="h-6 w-6 text-rose-500/40 mb-3" />
                <div>
                  <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Absent</p>
                  <h3 className="text-3xl font-black italic text-white">{classStats.absent}</h3>
                </div>
              </Card>
          </div>
        </div>

        <div className="space-y-4 pb-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 ml-2">Console Access</h3>
          
          <Card className="glass-card bg-slate-900/60 p-6 rounded-3xl border-white/5 active:scale-95 transition-all" onClick={() => setIsRosterDialogOpen(true)}>
            <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20"><Database className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                    <h4 className="text-lg font-black italic uppercase tracking-tighter text-white">Student Roster</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Manage Biometric Records</p>
                </div>
            </div>
          </Card>

          <Card className="glass-card bg-slate-900/60 p-6 rounded-3xl border-white/5 active:scale-95 transition-all" onClick={() => setIsReportDialogOpen(true)}>
            <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20"><BookOpen className="h-6 w-6 text-indigo-500" /></div>
                <div className="flex-1">
                    <h4 className="text-lg font-black italic uppercase tracking-tighter text-white">Analytics</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Attendance Reports</p>
                </div>
            </div>
          </Card>

          <Card className="glass-card bg-slate-900/60 p-6 rounded-3xl border-white/5 active:scale-95 transition-all" onClick={() => setIsFacultyDialogOpen(true)}>
            <div className="flex items-center gap-4">
                <div className="p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20"><Users className="h-6 w-6 text-orange-500" /></div>
                <div className="flex-1">
                    <h4 className="text-lg font-black italic uppercase tracking-tighter text-white">Faculty Node</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notification Access</p>
                </div>
            </div>
          </Card>

          <Card className="glass-card bg-slate-900/60 p-6 rounded-3xl border-white/5 active:scale-95 transition-all" onClick={() => setIsHistoryAuditOpen(true)}>
            <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20"><History className="h-6 w-6 text-emerald-500" /></div>
                <div className="flex-1">
                    <h4 className="text-lg font-black italic uppercase tracking-tighter text-white">Audit Log</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Historical Records</p>
                </div>
            </div>
          </Card>

          <Card className="glass-card bg-slate-900/60 p-6 rounded-3xl border-primary/30 active:scale-95 transition-all" onClick={() => setIsDeviceCenterOpen(true)}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-800 rounded-2xl"><Cpu className="h-6 w-6 text-slate-400" /></div>
                    <div>
                        <h4 className="text-lg font-black italic uppercase tracking-tighter text-white">Hardware</h4>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">OS Level Control</p>
                    </div>
                </div>
                <div className={cn("h-2 w-2 rounded-full", isDeviceOnline ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500")} />
            </div>
          </Card>
        </div>
      </main>

      <Dialog open={isRosterDialogOpen} onOpenChange={setIsRosterDialogOpen}>
        <DialogContent className="max-w-full h-full flex flex-col p-0 overflow-hidden bg-slate-950 border-none rounded-none">
          <DialogHeader className="px-6 pt-16 pb-6 bg-slate-900/50 backdrop-blur-3xl shrink-0">
            <button onClick={() => setIsRosterDialogOpen(false)} className="absolute top-6 left-6 h-8 px-3 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2 text-white/60 text-[9px] font-black uppercase">
               <ChevronLeft className="h-4 w-4" /> BACK
            </button>
            <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase text-white mt-4">STUDENT <span className="text-primary">ROSTER</span></DialogTitle>
            
            {/* SEARCH AND FILTER UI */}
            <div className="mt-6 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Search name or roll no..." 
                        className="h-10 pl-10 bg-slate-800 border-white/5 text-white rounded-xl text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button size="sm" className="bg-primary rounded-xl font-black uppercase italic text-[10px] shrink-0" onClick={() => setIsAddStudentDialogOpen(true)}>Add Student</Button>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="h-9 min-w-[120px] bg-slate-800 border-white/5 text-white text-[10px] font-black uppercase rounded-xl">
                            <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="All">All Classes</SelectItem>
                            {classNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
             <StudentTable
                students={filteredStudents}
                attendanceMode={appState === "attending"}
                attendanceType={attendanceType}
                onManualMark={(id, status) => {
                    const dateKey = format(selectedDate || new Date(), "yyyy-MM-dd");
                    const student = allStudents.find(s => s.id === id);
                    if (student) updateStudent(currentUser!.uid, id, { attendance: { ...student.attendance, [dateKey]: status } });
                }}
                onViewHistory={setSelectedStudentForCalendar}
                onEdit={setStudentToEdit}
                onDelete={(s) => setStudentToDelete(s)}
                onEnroll={(s) => {
                   addDoc(collection(db, "kiosk_commands"), {
                    type: "ENROLL", studentId: s.id, studentName: s.name, deviceId: deviceStatus?.deviceId, status: "pending", createdAt: serverTimestamp(), userId: currentUser?.uid
                   });
                   setAppState("enrolling");
                }}
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
        onOpenChange={(open) => {
          setIsAddStudentDialogOpen(open);
          if (!open) setAppState("idle");
        }} 
        onStudentAdded={async (d) => {
          if (!currentUser) return null;
          const sId = await addStudent(currentUser.uid, {...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'});
          const finalStudent = {id: sId, ...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'};
          setStudentToEnroll(finalStudent);
          return finalStudent;
        }} 
        isAdding={isPending} allStudents={allStudents} studentToEnroll={studentToEnroll} 
        onEnroll={(s) => {
           addDoc(collection(db, "kiosk_commands"), {
            type: "ENROLL", studentId: s.id, studentName: s.name, deviceId: deviceStatus?.deviceId, status: "pending", createdAt: serverTimestamp(), userId: currentUser?.uid
          });
          setAppState("enrolling");
        }} 
        enrollmentStatus={deviceStatus?.enrollment_status} 
        arduinoStatus={{ connected: isDeviceOnline || false, message: isDeviceOnline ? "Online" : "Offline" }} 
        appState={appState} 
      />
      
      <EditStudentDialog student={studentToEdit} isOpen={!!studentToEdit} onOpenChange={() => setStudentToEdit(null)} onStudentUpdated={(s) => currentUser && updateStudent(currentUser.uid, s.id, s)} isUpdating={isPending} />
      <AttendanceCalendarDialog student={selectedStudentForCalendar} isOpen={!!selectedStudentForCalendar} onOpenChange={() => setSelectedStudentForCalendar(null)} />
      <AttendanceReportDialog isOpen={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} students={allStudents} classNames={classNames} />
      <DeleteStudentAlert isOpen={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)} onConfirm={async () => {
         if (studentToDelete && currentUser) {
             await deleteStudent(currentUser.uid, studentToDelete.id);
             setStudentToDelete(null);
             toast({ title: "Deleted" });
         }
      }} studentName={studentToDelete?.name} isDeleting={isPending} />
      <ManageFacultyDialog isOpen={isFacultyDialogOpen} onOpenChange={setIsFacultyDialogOpen} faculties={faculties} onRefresh={() => {}} userId={currentUser?.uid || ''} />
      <DeviceCenterDialog isOpen={isDeviceCenterOpen} onOpenChange={setIsDeviceCenterOpen} userId={currentUser?.uid || ''} />
      <HistoryAuditDialog isOpen={isHistoryAuditOpen} onOpenChange={setIsHistoryAuditOpen} students={allStudents} classNames={classNames} onViewProfile={setSelectedStudentForCalendar} />
      <ProfileSettingsDialog isOpen={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} profile={userProfile} onRefresh={() => {}} />

      <style jsx global>{`
        .text-glow-white { text-shadow: 0 0 40px rgba(255,255,255,0.3); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
