
"use client";

import * as React from "react";
import { useState, useTransition, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Student, Faculty, UserProfile } from "@/lib/types";
import { 
  deleteStudent, addStudent, updateStudent,
  getFaculties
} from "@/services/firestore";
import { format, startOfDay } from "date-fns";
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
import { ProfileSettingsDialog } from "@/components/dashboard/profile-settings-dialog";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  Activity, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Database, 
  Sparkles,
  Terminal,
  Signal,
  CalendarCheck,
  ChevronLeft,
  BookOpen,
  Clock,
  Cpu,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-10 group">
          <div className="relative p-10 bg-slate-900/60 rounded-[2.5rem] border border-primary/20 shadow-[0_0_60px_-15px_rgba(59,130,246,0.5)]">
            <CalendarCheck className="h-24 w-24 text-primary" />
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
            <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <div className="h-12 flex flex-col items-center justify-center">
            <div className="flex items-center gap-3 text-emerald-400/80 font-mono text-[11px] font-black italic">
              <Terminal className="h-3 w-3" />
              <span className="uppercase tracking-widest">{logs[logIndex]}</span>
            </div>
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
  const [isDeviceCenterOpen, setIsDeviceCenterOpen] = useState(false);
  const [isRosterDialogOpen, setIsRosterDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isSmsNotAvailableOpen, setIsSmsNotAvailableOpen] = useState(false);
  
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
      if (user) setCurrentUser(user);
      else { setIsLoading(false); router.push("/login"); }
    });
    return unsub;
  }, [auth, router]);

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
    const isPastDate = selectedDate ? startOfDay(selectedDate) < startOfDay(new Date()) : false;
    return allStudents.map(student => {
      let status = (student.attendance && student.attendance[dateKey]) || null;
      if (!status && isPastDate) status = 'absent';
      return { ...student, status };
    });
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
    if (!deviceStatus?.deviceId) { toast({ variant: "destructive", title: "No Hardware Linked" }); return; }
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
    <div className="flex flex-col min-h-screen bg-background">
      <Header 
        userEmail={currentUser?.email} 
        userName={userProfile?.displayName} 
        onProfileClick={() => setIsProfileDialogOpen(true)}
      >
        <div className="flex items-center gap-4">
          <Link href={`/kiosk?deviceId=${deviceStatus?.deviceId || ''}`} target="_blank">
            <Button variant="outline" size="sm" className="hidden md:flex border-primary/40 text-primary rounded-2xl font-black italic uppercase h-9">
              <ExternalLink className="mr-2 h-4 w-4" /> Preview Kiosk
            </Button>
          </Link>
          <Button 
            variant={isDeviceOnline ? "success" : "destructive"} 
            size="sm" 
            className="hidden md:flex font-black italic uppercase rounded-2xl h-9"
            onClick={() => setIsDeviceCenterOpen(true)}
          >
            <Activity className="mr-2 h-4 w-4" /> {isDeviceOnline ? "LIVE" : "OFFLINE"}
          </Button>
        </div>
      </Header>
      
      <main className="flex-1 container mx-auto p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 flex items-center gap-4 bg-slate-900/40 border border-white/5 rounded-2xl p-4">
             <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                <Signal className="h-5 w-5 text-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-emerald-400">DATABASE LIVE</p>
             </div>
             <div className="flex-1 flex items-center gap-3 bg-black/40 px-4 py-3 rounded-xl border border-white/5 overflow-hidden">
                <Terminal className="h-4 w-4 text-primary animate-pulse" />
                <div className="text-[11px] font-mono text-primary/60 truncate">
                   [SYSTEM_LOG]: Hybrid Engine Active... {lastMarkedStudent ? `Last Sync: ${lastMarkedStudent} marked present` : ''}
                </div>
             </div>
          </div>
          <div className="md:col-span-4 flex items-center justify-between bg-slate-900/40 border border-white/5 rounded-2xl p-4">
             <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-primary" /><span className="text-sm font-black text-white italic">{format(new Date(), "HH:mm:ss")}</span></div>
             <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest">OS Active</span>
          </div>
        </div>

        <div className="relative bg-slate-900/30 rounded-[3rem] border border-white/5 p-10 overflow-hidden min-h-[300px] flex flex-col justify-center">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary bg-primary/10 w-fit px-4 py-1 rounded-full border border-primary/20">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Command Hub v11 HYBRID</span>
              </div>
              <h2 className="text-7xl font-black italic tracking-tighter uppercase leading-none text-glow-white">
                {userProfile?.instituteName?.split(' ')[0] || "COMMAND"} <span className="text-primary">{userProfile?.instituteName?.split(' ').slice(1).join(' ') || "CENTER"}</span>
              </h2>
            </div>
            <div className="flex flex-col items-end gap-4 bg-slate-900/50 p-4 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
              <AttendanceControls appState={appState} onStartAttendanceClick={handleStartAttendance} onEndAttendanceClick={handleEndAttendance} compact />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="glass-card p-8 flex items-center justify-between border-primary/20 bg-primary/5 rounded-[2.5rem]">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Population</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-white">{classStats.total}</h3>
            </div>
            <Users className="h-16 w-16 text-primary/10" />
          </Card>
          <Card className="glass-card p-8 flex items-center justify-between border-emerald-500/20 bg-emerald-500/5 rounded-[2.5rem]">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Presence</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-white">{classStats.present}</h3>
            </div>
            <CheckCircle2 className="h-16 w-16 text-emerald-500/10" />
          </Card>
          <Card className="glass-card p-8 flex items-center justify-between border-rose-500/20 bg-rose-500/5 rounded-[2.5rem]">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Absence</p>
              <h3 className="text-6xl font-black italic tracking-tighter text-white">{classStats.absent}</h3>
            </div>
            <XCircle className="h-16 w-16 text-rose-500/10" />
          </Card>
        </div>

        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 pb-20">
          <Card className="glass-card group cursor-pointer hover:border-primary/50 rounded-[3rem] p-10 space-y-6 border-white/5" onClick={() => setIsRosterDialogOpen(true)}>
            <div className="p-6 bg-primary/10 rounded-3xl w-fit border border-primary/20"><Database className="h-10 w-10 text-primary" /></div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Student <span className="text-primary">Console</span></h3>
            <Button variant="outline" className="w-full border-primary/30 text-primary rounded-2xl h-12 font-black italic uppercase tracking-widest bg-primary/5">Launch Console</Button>
          </Card>

          <Card className="glass-card group cursor-pointer hover:border-indigo-500/50 rounded-[3rem] p-10 space-y-6 border-white/5" onClick={() => setIsReportDialogOpen(true)}>
            <div className="p-6 bg-indigo-500/10 rounded-3xl w-fit border border-indigo-500/20"><BookOpen className="h-10 w-10 text-indigo-500" /></div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Report <span className="text-indigo-500">Center</span></h3>
            <Button variant="outline" className="w-full border-indigo-500/30 text-indigo-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-indigo-500/5">View Analytics</Button>
          </Card>

          <Card className="glass-card group cursor-pointer hover:border-orange-500/50 rounded-[3rem] p-10 space-y-6 border-white/5" onClick={() => setIsSmsNotAvailableOpen(true)}>
            <div className="p-6 bg-orange-500/10 rounded-3xl w-fit border border-orange-500/20"><MessageSquare className="h-10 w-10 text-orange-500" /></div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Send SMS <span className="text-orange-500">Notification</span></h3>
            <Button variant="outline" className="w-full border-orange-500/30 text-orange-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-orange-500/5">Launch Terminal</Button>
          </Card>

          <Card className="glass-card group cursor-pointer hover:border-emerald-500/50 rounded-[3rem] p-10 space-y-6 border-white/5" onClick={() => setIsDeviceCenterOpen(true)}>
            <div className="flex justify-between items-start">
               <div className={cn("p-6 rounded-3xl border transition-all", isDeviceOnline ? "bg-emerald-500/10 border-emerald-500/30" : "bg-muted")}><Cpu className={cn("h-10 w-10", isDeviceOnline ? "text-emerald-500" : "text-muted-foreground")} /></div>
               <div className={cn("h-3 w-3 rounded-full", isDeviceOnline ? "bg-emerald-500" : "bg-rose-500")} />
            </div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Device <span className="text-emerald-500">Center</span></h3>
            <Button variant="outline" className="w-full border-emerald-500/30 text-emerald-500 rounded-2xl h-12 font-black italic uppercase tracking-widest bg-emerald-500/5">Open OS Terminal</Button>
          </Card>
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
                  <Button className="bg-primary hover:bg-primary/90 font-black italic uppercase h-12 px-8 rounded-2xl shadow-xl" onClick={() => { setStudentToEnroll(null); setIsAddStudentDialogOpen(true); }}><Users className="mr-2 h-5 w-5" /> Enroll Student</Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-10 py-10">
             <StudentTable students={filteredStudents} attendanceMode={appState === "attending"} attendanceType={attendanceType} onManualMark={(id, status) => currentUser && updateStudent(currentUser.uid, id, { attendance: { ...allStudents.find(s => s.id === id)!.attendance, [format(selectedDate || new Date(), "yyyy-MM-dd")]: status } })} onViewHistory={setSelectedStudentForCalendar} onEdit={setStudentToEdit} onDelete={setStudentToDelete} onEnroll={(s) => { setStudentToEnroll(s); setIsAddStudentDialogOpen(true); }} isLoading={false} selectedDate={selectedDate} onSendNotifications={() => {}} attendanceTaken={appState === "attending"} isPending={isPending} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSmsNotAvailableOpen} onOpenChange={setIsSmsNotAvailableOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 rounded-[2.5rem] p-10 text-center">
            <div className="flex justify-center mb-6">
                <div className="p-6 bg-orange-500/10 rounded-full border border-orange-500/20">
                    <AlertCircle className="h-12 w-12 text-orange-500 animate-pulse" />
                </div>
            </div>
            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-white mb-2">ACCESS RESTRICTED</DialogTitle>
            <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                This feature is currently not available in your region or tier.
            </DialogDescription>
            <DialogFooter className="mt-8">
                <Button onClick={() => setIsSmsNotAvailableOpen(false)} className="w-full h-12 bg-slate-800 hover:bg-slate-700 text-white font-black italic uppercase rounded-xl">DISMISS</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddStudentDialog isOpen={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen} onStudentAdded={async (d) => { if (!currentUser) return null; const classStudents = allStudents.filter(s => s.className === d.className); const maxRoll = classStudents.reduce((max, s) => Math.max(max, s.rollNo || 0), 0); const sId = await addStudent(currentUser.uid, { ...d, rollNo: maxRoll + 1, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED' }); const finalStudent = {id: sId, ...d, rollNo: maxRoll + 1, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'}; setStudentToEnroll(finalStudent); return finalStudent; }} isAdding={isPending} allStudents={allStudents} studentToEnroll={studentToEnroll} onEnroll={(s) => { addDoc(collection(db, "kiosk_commands"), { type: "ENROLL", studentId: s.id, studentName: s.name, deviceId: deviceStatus?.deviceId, status: "pending", createdAt: serverTimestamp(), userId: currentUser?.uid }); setAppState("enrolling"); }} enrollmentStatus={deviceStatus?.enrollment_status} arduinoStatus={{ connected: isDeviceOnline || false, message: isDeviceOnline ? "Online" : "Offline" }} appState={appState} />
      <EditStudentDialog student={studentToEdit} isOpen={!!studentToEdit} onOpenChange={() => setStudentToEdit(null)} onStudentUpdated={(s) => currentUser && updateStudent(currentUser.uid, s.id, s)} isUpdating={isPending} />
      <AttendanceCalendarDialog student={selectedStudentForCalendar} isOpen={!!selectedStudentForCalendar} onOpenChange={() => setSelectedStudentForCalendar(null)} />
      <AttendanceReportDialog isOpen={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} students={allStudents} classNames={classNames} onStudentSelect={setSelectedStudentForCalendar} />
      <DeleteStudentAlert isOpen={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)} onConfirm={async () => { if (studentToDelete && currentUser) { await deleteStudent(currentUser.uid, studentToDelete.id); setStudentToDelete(null); toast({ title: "Deleted" }); } }} studentName={studentToDelete?.name} isDeleting={isPending} />
      <DeviceCenterDialog isOpen={isDeviceCenterOpen} onOpenChange={setIsDeviceCenterOpen} userId={currentUser?.uid || ''} />
      <ProfileSettingsDialog isOpen={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} profile={userProfile} onRefresh={() => {}} />
    </div>
  );
}
