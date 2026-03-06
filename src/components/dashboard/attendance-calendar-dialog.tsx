"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  GraduationCap, 
  Hash, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Activity, 
  Zap,
  User,
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";

type AttendanceCalendarDialogProps = {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function AttendanceCalendarDialog({ student, isOpen, onOpenChange }: AttendanceCalendarDialogProps) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);

  if (!student) return null;

  const presentDays = Object.entries(student.attendance || {})
    .filter(([, status]) => status === 'present')
    .map(([date]) => new Date(date));

  const absentDays = Object.entries(student.attendance || {})
    .filter(([, status]) => status === 'absent')
    .map(([date]) => new Date(date));

  const totalTracked = presentDays.length + absentDays.length;
  const attendancePercentage = totalTracked > 0 ? (presentDays.length / totalTracked) * 100 : 0;

  const exportToPDF = () => {
    if (!student) return;
    const doc = new jsPDF();
    const primaryColor = [56, 163, 165]; // teal from theme

    doc.setFontSize(26);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Attendance HUB", 14, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(80);
    doc.text(`Student Performance Report: ${student.name}`, 14, 35);

    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Generated on: ${format(new Date(), "PPP p")}`, 14, 42);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Student Identity Profile", 14, 58);

    autoTable(doc, {
        startY: 62,
        head: [['Field', 'Detail']],
        body: [
            ['Name', student.name],
            ['Roll Number', student.rollNo.toString()],
            ['Class', student.className],
            ['Contact', student.phone],
            ['Total Days Tracked', totalTracked.toString()],
            ['Present Days', presentDays.length.toString()],
            ['Absent Days', absentDays.length.toString()],
            ['Attendance Percentage', `${attendancePercentage.toFixed(1)}%`],
        ],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 50 } },
        headStyles: { fillColor: primaryColor, textColor: 255 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Attendance Log History", 14, finalY);

    const logs = Object.entries(student.attendance || {})
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, status]) => [format(new Date(date), "PPP"), status.toUpperCase()]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Attendance Status']],
      body: logs,
      headStyles: { fillColor: primaryColor, textColor: 255 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      styles: { cellPadding: 4, fontSize: 9 },
    });

    doc.save(`Report_${student.name.replace(/\s+/g, '_')}.pdf`);
    toast({ title: "Report Downloaded", description: `PDF report for ${student.name} saved successfully.` });
  };

  const handleSyncCache = () => {
    setIsSyncing(true);
    // Mock sync logic
    setTimeout(() => {
      setIsSyncing(false);
      toast({
        title: "Biometric Cache Synced",
        description: `Local ID cache for ${student.name} has been refreshed with BioSync Cloud.`,
      });
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem]">
        <DialogHeader className="px-10 pt-24 pb-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 left-10 z-[160] h-10 px-5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl flex items-center gap-2 text-primary transition-all active:scale-95 shadow-lg"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-widest">BACK</span>
          </button>

          <div className="relative z-10 pt-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em]">Biometric Identity Profile</span>
            </div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <DialogTitle className="text-5xl font-black italic tracking-tighter uppercase text-white leading-none">
                        {student.name}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" /> {student.className} 
                        <span className="text-white/10 mx-2">•</span> 
                        <Hash className="h-4 w-4" /> Roll No: {student.rollNo}
                    </DialogDescription>
                </div>
                <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                    <Phone className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-mono font-black text-white">{student.phone}</span>
                </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-emerald-500/5 border-emerald-500/20 p-6 rounded-3xl group hover:bg-emerald-500/10 transition-all">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">VERIFIED PRESENCE</p>
                    <div className="flex items-end justify-between">
                        <span className="text-5xl font-black italic tracking-tighter text-white">{presentDays.length}</span>
                        <CheckCircle2 className="h-10 w-10 text-emerald-500/30 group-hover:scale-110 transition-transform" />
                    </div>
                </Card>
                <Card className="bg-rose-500/5 border-rose-500/20 p-6 rounded-3xl group hover:bg-rose-500/10 transition-all">
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4">REPORTED ABSENCE</p>
                    <div className="flex items-end justify-between">
                        <span className="text-5xl font-black italic tracking-tighter text-white">{absentDays.length}</span>
                        <XCircle className="h-10 w-10 text-rose-500/30 group-hover:scale-110 transition-transform" />
                    </div>
                </Card>
                <Card className="bg-primary/10 border-primary/20 p-6 rounded-3xl group hover:bg-primary/20 transition-all shadow-[0_15px_40px_rgba(59,130,246,0.1)]">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">CONSISTENCY SCORE</p>
                    <div className="flex items-end justify-between">
                        <span className="text-5xl font-black italic tracking-tighter text-white">{attendancePercentage.toFixed(1)}%</span>
                        <Percent className="h-10 w-10 text-primary/30 group-hover:scale-110 transition-transform" />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <Card className="lg:col-span-7 bg-slate-900/40 border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
                    <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-8 flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" /> HISTORICAL ATTENDANCE LOG
                    </h3>
                    <div className="flex justify-center bg-black/20 rounded-3xl p-6 border border-white/5">
                        <Calendar
                            mode="multiple"
                            selected={[...presentDays, ...absentDays]}
                            modifiers={{
                                present: presentDays,
                                absent: absentDays,
                            }}
                            modifiersStyles={{
                                present: {
                                    color: 'white',
                                    backgroundColor: 'hsl(142, 71%, 45%)', 
                                    borderRadius: '12px',
                                    fontWeight: '900'
                                },
                                absent: {
                                    color: 'white',
                                    backgroundColor: 'hsl(346, 84%, 61%)', 
                                    borderRadius: '12px',
                                    fontWeight: '900'
                                }
                            }}
                            className="rounded-md scale-110"
                            numberOfMonths={1}
                            defaultMonth={new Date()}
                        />
                    </div>
                    <div className="flex justify-center gap-8 mt-10">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Present</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Absent</span>
                        </div>
                    </div>
                </Card>

                <div className="lg:col-span-5 space-y-6">
                    <Card className="bg-slate-900/40 border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 mb-6">SYSTEM METRICS</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <Activity className="h-4 w-4 text-primary" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Days Tracked</span>
                                </div>
                                <span className="text-sm font-black text-white italic">{totalTracked} Days</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <User className="h-4 w-4 text-emerald-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fingerprint Status</span>
                                </div>
                                <Badge className="bg-emerald-500 text-white font-black italic text-[9px] uppercase px-3 py-1 rounded-lg">VERIFIED</Badge>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-all">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-4 relative z-10">ACTION HUB</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6 relative z-10">Generate custom reports or export biometric data for this student.</p>
                        <div className="space-y-3 relative z-10">
                            <Button 
                              variant="outline" 
                              onClick={exportToPDF}
                              className="w-full h-12 bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white font-black italic uppercase tracking-widest text-[10px] rounded-xl transition-all"
                            >
                                DOWNLOAD PDF REPORT
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={handleSyncCache}
                              disabled={isSyncing}
                              className="w-full h-12 bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 font-black italic uppercase tracking-widest text-[10px] rounded-xl transition-all"
                            >
                                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "SYNC BIOMETRIC CACHE"}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
