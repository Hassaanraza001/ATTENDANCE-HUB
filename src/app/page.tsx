
"use client";

import * as React from "react";
import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Student, Faculty } from "@/lib/types";
import { 
  updateStudentsAttendance, deleteStudent, addStudent, updateStudent,
  getFaculties
} from "@/services/firestore";
import { format } from "date-fns";
import { getAuthInstance, getDb } from "@/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, limit } from "firebase/firestore";

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
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Monitor, Cpu, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";

type AppState = "idle" | "attending" | "enrolling";
type AttendanceType = "biometric" | "manual";

export default function DashboardPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [appState, setAppState] = useState<AppState>("idle");
  const [attendanceType, setAttendanceType] = useState<AttendanceType>("biometric");
  
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isFacultyDialogOpen, setIsFacultyDialogOpen] = useState(false);
  const [isDeviceCenterOpen, setIsDeviceCenterOpen] = useState(false);
  
  const [studentToEnroll, setStudentToEnroll] = useState<Student | null>(null);
  const [selectedStudentForCalendar, setSelectedStudentForCalendar] = useState<Student | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const auth = getAuthInstance();
  const db = getDb();
  
  const [deviceStatus, setDeviceStatus] = useState<any>(null);

  const fetchFaculty = useCallback(async (userId: string) => {
    try {
      const facultiesFromDB = await getFaculties(userId);
      setFaculties(facultiesFromDB);
    } catch (error) {
      console.error("Error fetching faculty:", error);
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        fetchFaculty(user.uid);
        
        // Dynamic Heartbeat Listener
        const qStatus = query(collection(db, "system_status"), where("userId", "==", user.uid), limit(1));
        const statusUnsub = onSnapshot(qStatus, (snap) => {
          if (!snap.empty) setDeviceStatus(snap.docs[0].data());
          else setDeviceStatus(null);
        });

        const qStudents = query(collection(db, "students"), where("userId", "==", user.uid));
        const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
          const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
          setAllStudents(studentsData);
          setIsLoading(false);
        });

        return () => {
          unsubscribeStudents();
          statusUnsub();
        };
      } else {
        router.push("/login");
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router, auth, db, fetchFaculty]);

  const students = useMemo(() => {
    if (!currentUser) return [];
    const dateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    return allStudents.map(student => ({
      ...student,
      status: (student.attendance && student.attendance[dateKey]) || null
    }));
  }, [allStudents, currentUser, selectedDate]);

  const classNames = useMemo(() => {
    return [...new Set(allStudents.map(s => s.className).filter(name => !!name && name.trim() !== ''))];
  }, [allStudents]);

  const filteredStudents = useMemo(() => {
    let studentsByClass = students;
    if (selectedClass !== "All") {
      studentsByClass = students.filter(s => s.className === selectedClass);
    }
    if (!searchQuery) return studentsByClass;
    return studentsByClass.filter(s => 
      s.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, selectedClass, searchQuery]);

  const handleStartAttendance = (type: AttendanceType) => {
    if (!deviceStatus?.deviceId) {
        toast({ variant: "destructive", title: "No Hardware Linked", description: "Link your Attendance Box first." });
        return;
    }
    setAttendanceType(type);
    setAppState("attending");
    if (type === 'biometric' && currentUser) {
      addDoc(collection(db, "kiosk_commands"), {
        type: "START_SCAN", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
    toast({ title: "Attendance Session Started" });
  };

  const handleEndAttendance = () => {
    if (!currentUser || !deviceStatus?.deviceId) return;
    setAppState("idle");
    if (attendanceType === 'biometric') {
      addDoc(collection(db, "kiosk_commands"), {
        type: "END_SCAN", deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
      });
    }
    toast({ title: "Session Closed" });
  };

  const isDeviceOnline = deviceStatus && (new Date().getTime() - (deviceStatus.last_online?.toDate().getTime() || 0) < 60000);

  if (isLoading || !currentUser) {
    return (
       <div className="flex flex-col min-h-screen justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground uppercase font-black tracking-tighter italic italic">System Powering Up...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header userEmail={currentUser.email}>
        <div className="flex items-center gap-3">
          <Button 
            variant={isDeviceOnline ? "success" : "destructive"} 
            size="sm" 
            className="hidden md:flex font-black tracking-tighter italic uppercase"
            onClick={() => setIsDeviceCenterOpen(true)}
          >
            {isDeviceOnline ? <Activity className="mr-2 h-4 w-4 animate-pulse" /> : <Activity className="mr-2 h-4 w-4" />}
            {isDeviceOnline ? `${deviceStatus?.cpu_temp?.toFixed(0)}°C` : "OFFLINE"}
          </Button>
          <Button variant="outline" className="border-2 rounded-xl" onClick={() => setIsReportDialogOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" /> Reports
          </Button>
        </div>
      </Header>
      
      <main className="flex-1 container mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <AttendanceControls
          appState={appState}
          onAddStudentClick={() => setIsAddStudentDialogOpen(true)}
          onStartAttendanceClick={handleStartAttendance}
          onEndAttendanceClick={handleEndAttendance}
          onManageFacultyClick={() => setIsFacultyDialogOpen(true)}
          classNames={classNames}
          selectedClass={selectedClass}
          onClassChange={setSelectedClass}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <StudentTable
              students={filteredStudents}
              attendanceMode={appState === "attending"}
              attendanceType={attendanceType}
              onManualMark={(id, status) => {
                  const student = allStudents.find(s => s.id === id);
                  if (student && selectedDate) {
                      updateStudent(id, { attendance: { ...student.attendance, [format(selectedDate, "yyyy-MM-dd")]: status } });
                  }
              }}
              onViewHistory={(s) => setSelectedStudentForCalendar(s)}
              onEdit={(s) => setStudentToEdit(s)}
              onDelete={(s) => setStudentToDelete(s)}
              onEnroll={(s) => {
                  if (!deviceStatus?.deviceId) {
                      toast({ variant: "destructive", title: "Device Error", description: "No hardware linked." });
                      return;
                  }
                  setStudentToEnroll(s);
                  addDoc(collection(db, "kiosk_commands"), {
                    type: "ENROLL", studentId: s.id, studentName: s.name, deviceId: deviceStatus.deviceId, userId: currentUser.uid, status: "pending", createdAt: serverTimestamp()
                  });
              }}
              isLoading={isLoading}
              selectedDate={selectedDate}
              onSendNotifications={() => {}}
              attendanceTaken={false}
              isPending={isPending}
            />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Card className="h-64 flex flex-col justify-center items-center bg-card/50 border-2 border-dashed group cursor-pointer hover:border-primary/50 transition-all rounded-[2rem]" onClick={() => setIsDeviceCenterOpen(true)}>
                <div className="text-center p-6 space-y-4">
                  <div className="relative">
                    <div className={isDeviceOnline ? "absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" : ""} />
                    <Cpu className={isDeviceOnline ? "h-16 w-16 text-emerald-500 mx-auto relative animate-bounce" : "h-16 w-16 text-muted-foreground mx-auto relative"} />
                  </div>
                  <div>
                    <p className="font-black text-2xl tracking-tighter italic uppercase">{isDeviceOnline ? "Hardware Heartbeat" : "Device Link Broken"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.4em] font-bold">
                      {isDeviceOnline ? `ID: ${deviceStatus?.deviceId}` : "Connect your Raspberry Pi"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="bg-primary/5 hover:bg-primary hover:text-white transition-all rounded-xl font-bold italic">
                    {deviceStatus ? "Manage Hardware" : "Link New Box"}
                  </Button>
                </div>
            </Card>
          </div>
        </div>
      </main>

      <AddStudentDialog isOpen={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen} onStudentAdded={async (d) => {
        const s = await addStudent({...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'});
        return {id: s, ...d, rollNo: 0, attendance: {}, userId: currentUser.uid, fingerprintID: 'NOT_ENROLLED'};
      }} isAdding={isPending} allStudents={allStudents} studentToEnroll={studentToEnroll} onEnroll={() => {}} enrollmentStatus={deviceStatus?.enrollment_status} arduinoStatus={{ connected: isDeviceOnline || false, message: isDeviceOnline ? "Pi Online" : "Pi Offline" }} appState={appState} />
      <EditStudentDialog student={studentToEdit} isOpen={!!studentToEdit} onOpenChange={() => setStudentToEdit(null)} onStudentUpdated={(s) => updateStudent(s.id, s)} isUpdating={isPending} />
      <AttendanceCalendarDialog student={selectedStudentForCalendar} isOpen={!!selectedStudentForCalendar} onOpenChange={() => setSelectedStudentForCalendar(null)} />
      <AttendanceReportDialog isOpen={isReportDialogOpen} onOpenChange={setIsReportDialogOpen} students={allStudents} classNames={classNames} />
      <DeleteStudentAlert isOpen={!!studentToDelete} onOpenChange={() => setStudentToDelete(null)} onConfirm={() => studentToDelete && deleteStudent(studentToDelete.id)} studentName={studentToDelete?.name} isDeleting={isPending} />
      <ManageFacultyDialog isOpen={isFacultyDialogOpen} onOpenChange={setIsFacultyDialogOpen} faculties={faculties} onRefresh={() => fetchFaculty(currentUser.uid)} userId={currentUser.uid} />
      <DeviceCenterDialog isOpen={isDeviceCenterOpen} onOpenChange={setIsDeviceCenterOpen} userId={currentUser.uid} />
    </div>
  );
}
