"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import { format, eachDayOfInterval, startOfDay, startOfMonth, endOfMonth, getYear, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, FileSpreadsheet, FileText, Users, CheckCircle, XCircle, TrendingUp, User, PieChart as PieIcon, BarChart3, Search, CalendarDays, ChevronLeft, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

type AttendanceReportDialogProps = {
  students: Student[];
  classNames: string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

type ReportData = {
  studentId: string;
  name: string;
  rollNo: number;
  presentCount: number;
  absentCount: number;
  totalWorkingDays: number;
  percentage: number;
}[];

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const COLORS = ["#38A3A5", "#D98E5B"];

const getYears = () => {
    const currentYear = getYear(new Date());
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
        years.push(i);
    }
    return years;
};

export function AttendanceReportDialog({
  students,
  classNames,
  isOpen,
  onOpenChange,
}: AttendanceReportDialogProps) {
  const [activeTab, setActiveTab] = React.useState("class-view");
  const [reportType, setReportType] = React.useState("range");
  const [selectedClass, setSelectedClass] = React.useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [reportData, setReportData] = React.useState<ReportData | null>(null);
  const [totalWorkingDays, setTotalWorkingDays] = React.useState<number>(0);
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("");
  
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedYear, setSelectedYear] = React.useState<number | null>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(new Date().getMonth());

  const handleBack = () => {
    if (activeTab === "student-view") {
      setActiveTab("class-view");
    } else {
      onOpenChange(false);
    }
  };

  const handleGenerateReport = () => {
    if (!selectedClass) return;

    let range: DateRange | undefined;
    if (reportType === 'range') {
        if (!dateRange?.from || !dateRange.to) return;
        range = dateRange;
    } else {
        if (selectedYear === null || selectedMonth === null) return;
        const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
        range = { from: monthStart, to: monthEnd };
    }

    const classStudents = students.filter((s) => s.className === selectedClass || selectedClass === "All");
    const interval = eachDayOfInterval({ 
        start: startOfDay(range.from!), 
        end: startOfDay(range.to!) 
    });
    
    const workingDays = new Set<string>();
    classStudents.forEach((student) => {
        interval.forEach((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            if (student.attendance && student.attendance[dateKey]) {
                workingDays.add(dateKey);
            }
        });
    });

    const totalWorkingDaysInRange = workingDays.size;
    setTotalWorkingDays(totalWorkingDaysInRange);

    const report = classStudents.map((student) => {
      let presentCount = 0;
      let absentCount = 0;

      workingDays.forEach((dateKey) => {
        const status = student.attendance[dateKey];
        if (status === "present") presentCount++;
        else if (status === "absent") absentCount++;
      });

      const percentage = totalWorkingDaysInRange > 0 ? (presentCount / totalWorkingDaysInRange) * 100 : 0;

      return {
        studentId: student.id,
        name: student.name,
        rollNo: student.rollNo,
        presentCount,
        absentCount,
        totalWorkingDays: totalWorkingDaysInRange,
        percentage
      };
    });

    setReportData(report.sort((a, b) => a.rollNo - b.rollNo));
  };

  const summaryStats = React.useMemo(() => {
    if (!reportData || reportData.length === 0) return null;
    const avgAttendance = reportData.reduce((acc, curr) => acc + curr.percentage, 0) / reportData.length;
    const sortedByPercentage = [...reportData].sort((a, b) => b.percentage - a.percentage);
    const topStudent = sortedByPercentage[0];
    const lowStudent = sortedByPercentage[reportData.length - 1];
    return { avgAttendance, topStudent, lowStudent };
  }, [reportData]);

  const exportToExcel = () => {
    if (!reportData || !selectedClass) return;
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(d => ({
      'Roll No': d.rollNo,
      'Student Name': d.name,
      'Present Days': d.presentCount,
      'Absent Days': d.absentCount,
      'Total Working Days': d.totalWorkingDays,
      'Attendance %': d.percentage.toFixed(1) + '%'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
    XLSX.writeFile(workbook, `Attendance_Report_${selectedClass.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportToPDF = () => {
    if (!reportData || !selectedClass || !summaryStats) return;
    const doc = new jsPDF();
    const primaryColor = [56, 163, 165]; 

    doc.setFontSize(26);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Attendance HUB", 14, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(80);
    doc.text(`Attendance Report: ${selectedClass === "All" ? "All Classes" : selectedClass}`, 14, 35);

    let dateStr = "";
    if (reportType === 'range' && dateRange?.from && dateRange.to) {
        dateStr = `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`;
    } else if (selectedYear !== null && selectedMonth !== null) {
        dateStr = `${MONTHS[selectedMonth]} ${selectedYear}`;
    }
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Reporting Period: ${dateStr}`, 14, 42);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Executive Summary", 14, 58);

    autoTable(doc, {
        startY: 62,
        head: [['Metric', 'Detail']],
        body: [
            ['Total Students', reportData.length.toString()],
            ['Total Working Days', totalWorkingDays.toString()],
            ['Average Class Attendance', `${summaryStats.avgAttendance.toFixed(1)}%`],
            ['Highest Attendance Student', `${summaryStats.topStudent.name} (${summaryStats.topStudent.percentage.toFixed(1)}%)`],
            ['Lowest Attendance Student', `${summaryStats.lowStudent.name} (${summaryStats.lowStudent.percentage.toFixed(1)}%)`],
        ],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 70 } },
        headStyles: { fillColor: primaryColor, textColor: 255 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Detailed Attendance Log", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Roll', 'Student Name', 'Present', 'Absent', 'Percentage']],
      body: reportData.map(d => [
          d.rollNo, 
          d.name, 
          d.presentCount, 
          d.absentCount, 
          d.percentage.toFixed(1) + '%'
      ]),
      headStyles: { fillColor: primaryColor, textColor: 255 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      styles: { cellPadding: 4, fontSize: 9 },
      margin: { top: 10 }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated: ${format(new Date(), "PPP p")} | Powered by Attendance HUB`, 14, 285);
        doc.text(`Page ${i} of ${pageCount}`, 180, 285);
    }

    doc.save(`Attendance_Report_${selectedClass.replace(/\s+/g, '_')}.pdf`);
  };

  const filteredStudentsForSearch = React.useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) || 
                           s.className.toLowerCase().includes(studentSearchQuery.toLowerCase());
      const matchesClass = selectedClass === "All" || !selectedClass || s.className === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [students, studentSearchQuery, selectedClass]);

  const selectedStudent = React.useMemo(() => 
    students.find(s => s.id === selectedStudentId), [students, selectedStudentId]
  );

  const studentChartData = React.useMemo(() => {
    if (!selectedStudent) return [];
    const monthlyStats: Record<string, { name: string; present: number; absent: number }> = {};
    Object.entries(selectedStudent.attendance).forEach(([date, status]) => {
      const monthLabel = format(parseISO(date), "MMM yy");
      if (!monthlyStats[monthLabel]) monthlyStats[monthLabel] = { name: monthLabel, present: 0, absent: 0 };
      if (status === 'present') monthlyStats[monthLabel].present++;
      else if (status === 'absent') monthlyStats[monthLabel].absent++;
    });
    return Object.values(monthlyStats).slice(-6);
  }, [selectedStudent]);

  const studentPieData = React.useMemo(() => {
    if (!selectedStudent) return [];
    let present = 0, absent = 0;
    Object.values(selectedStudent.attendance).forEach(v => {
      if (v === 'present') present++;
      else if (v === 'absent') absent++;
    });
    return [
      { name: 'Present', value: present },
      { name: 'Absent', value: absent },
    ];
  }, [selectedStudent]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-2xl rounded-3xl">
        <DialogHeader className="px-10 pt-24 pb-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <button 
            onClick={handleBack}
            className="absolute top-8 left-8 z-[160] h-10 px-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl flex items-center gap-2 text-primary hover:text-primary/80 transition-all active:scale-95 shadow-lg"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">BACK</span>
          </button>

          <div className="flex items-center justify-between pt-4">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                  <Zap className="h-4 w-4 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em]">Analytics Engine Active</span>
              </div>
              <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                REPORT <span className="text-primary">CENTER</span>
              </DialogTitle>
              <DialogDescription className="text-slate-400 font-medium text-sm">
                Detailed reports and visual insights for your institution.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-10 py-6 bg-slate-900/30 border-b border-white/5 flex flex-wrap items-center justify-between gap-6">
                <TabsList className="grid grid-cols-2 w-[320px] bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger value="class-view" className="gap-2 text-xs font-black uppercase italic tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                        <Users className="h-4 w-4" /> Class View
                    </TabsTrigger>
                    <TabsTrigger value="student-view" className="gap-2 text-xs font-black uppercase italic tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                        <User className="h-4 w-4" /> Student View
                    </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-4">
                    <Select onValueChange={setSelectedClass} value={selectedClass || ""}>
                        <SelectTrigger className="w-[200px] h-10 bg-slate-800/50 border-white/5 text-white font-bold uppercase italic tracking-tighter rounded-xl">
                            <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="All">All Classes</SelectItem>
                            {classNames.filter(name => !!name && name.trim() !== "").map((name) => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {activeTab === "student-view" && (
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search student..." 
                                    className="pl-10 w-[220px] h-10 bg-slate-800/50 border-white/5 text-white rounded-xl" 
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ""}>
                                <SelectTrigger className="w-[220px] h-10 bg-slate-800/50 border-white/5 text-white rounded-xl">
                                    <SelectValue placeholder="Choose Student" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                    {filteredStudentsForSearch.length > 0 ? (
                                        filteredStudentsForSearch.slice(0, 50).map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                ({s.rollNo}) {s.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>No results</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-10 py-10 space-y-8">
                <TabsContent value="class-view" className="m-0 space-y-8 outline-none">
                    <div className="flex flex-wrap items-center gap-4 p-6 bg-slate-900/40 rounded-3xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-1 bg-slate-800/50 p-1.5 rounded-xl border border-white/5">
                          <Button 
                            variant={reportType === 'range' ? "secondary" : "ghost"} 
                            size="sm" 
                            className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-lg", reportType === 'range' && "bg-primary text-white hover:bg-primary/90")}
                            onClick={() => setReportType('range')}
                          >
                            Range
                          </Button>
                          <Button 
                            variant={reportType === 'monthly' ? "secondary" : "ghost"} 
                            size="sm" 
                            className={cn("h-9 text-[10px] font-black uppercase tracking-widest rounded-lg", reportType === 'monthly' && "bg-primary text-white hover:bg-primary/90")}
                            onClick={() => setReportType('monthly')}
                          >
                            Monthly
                          </Button>
                        </div>

                        {reportType === 'range' ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-10 w-[280px] bg-slate-800/50 border-white/5 text-white font-bold rounded-xl justify-start">
                                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "PP")} - ${format(dateRange.to, "PP")}` : format(dateRange.from, "PP")) : "Select Dates"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="start">
                                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} className="bg-slate-900 text-white" />
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="flex gap-3 w-[280px]">
                                <Select onValueChange={(v) => setSelectedYear(Number(v))} value={String(selectedYear)}>
                                    <SelectTrigger className="h-10 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white">{getYears().map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select onValueChange={(v) => setSelectedMonth(Number(v))} value={String(selectedMonth)}>
                                    <SelectTrigger className="h-10 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-white/10 text-white">{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button onClick={handleGenerateReport} disabled={!selectedClass} className="h-10 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase italic tracking-widest rounded-xl transition-all hover:scale-105">Generate Report</Button>
                        
                        <div className="ml-auto flex gap-3">
                            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!reportData} className="h-10 bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportToPDF} disabled={!reportData} className="h-10 bg-rose-500/10 border-rose-500/20 text-rose-500 font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                              <FileText className="mr-2 h-4 w-4" /> PDF
                            </Button>
                        </div>
                    </div>

                    {reportData ? (
                        <div className="space-y-8 pb-10">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Card className="bg-slate-900/60 border-primary/20 shadow-2xl rounded-3xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><CalendarDays className="h-12 w-12" /></div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Working Days</p>
                                    <p className="text-4xl font-black italic tracking-tighter text-white">{totalWorkingDays}</p>
                                </Card>
                                <Card className="bg-slate-900/60 border-white/5 shadow-2xl rounded-3xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><CheckCircle className="h-12 w-12" /></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Avg. Attendance</p>
                                    <p className="text-4xl font-black italic tracking-tighter text-white">{summaryStats?.avgAttendance.toFixed(1)}%</p>
                                </Card>
                                <Card className="bg-slate-900/60 border-emerald-500/20 shadow-2xl rounded-3xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><TrendingUp className="h-12 w-12" /></div>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Top Student</p>
                                    <p className="text-xl font-black italic tracking-tighter text-white truncate">{summaryStats?.topStudent.name}</p>
                                </Card>
                                <Card className="bg-slate-900/60 border-rose-500/20 shadow-2xl rounded-3xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity"><XCircle className="h-12 w-12" /></div>
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Highest Absence</p>
                                    <p className="text-xl font-black italic tracking-tighter text-white truncate">{summaryStats?.lowStudent.name}</p>
                                </Card>
                            </div>
                            <Card className="rounded-[2.5rem] border border-white/5 bg-slate-900/40 shadow-2xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-800/50 h-14 border-b border-white/5">
                                            <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-slate-500">Roll No</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Student Name</TableHead>
                                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Present</TableHead>
                                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Absent</TableHead>
                                            <TableHead className="w-[240px] text-[10px] font-black uppercase tracking-widest text-slate-500">Performance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.map((d) => (
                                            <TableRow key={d.studentId} className="h-16 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                                                <TableCell className="text-sm font-black italic text-primary">{d.rollNo}</TableCell>
                                                <TableCell className="text-sm font-black italic uppercase tracking-tighter text-white">{d.name}</TableCell>
                                                <TableCell className="text-center font-black text-emerald-500">{d.presentCount}</TableCell>
                                                <TableCell className="text-center font-black text-rose-500">{d.absentCount}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-4">
                                                        <Progress value={d.percentage} className="h-2.5 flex-1 bg-white/5" />
                                                        <span className="text-xs font-black text-white min-w-[45px]">{d.percentage.toFixed(0)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-600 border border-dashed border-white/5 rounded-[3rem] bg-slate-900/20">
                            <Users className="h-20 w-20 mb-6 opacity-10" />
                            <p className="text-2xl font-black uppercase italic tracking-widest">Generate a report to see insights</p>
                            <p className="text-sm font-medium uppercase tracking-[0.3em] mt-2 opacity-50">Select a class and date range above.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="student-view" className="m-0 space-y-8 outline-none pb-10">
                    {selectedStudent ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Card className="bg-slate-900/60 border-white/5 p-8 text-center rounded-3xl shadow-2xl group transition-all hover:border-primary/20">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tracked Days</p>
                                    <p className="text-5xl font-black italic tracking-tighter text-white">{Object.keys(selectedStudent.attendance).length}</p>
                                </Card>
                                <Card className="bg-slate-900/60 border-emerald-500/20 p-8 text-center rounded-3xl shadow-2xl group transition-all hover:bg-emerald-500/5">
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Present Count</p>
                                    <p className="text-5xl font-black italic tracking-tighter text-emerald-500">{Object.values(selectedStudent.attendance).filter(v => v === 'present').length}</p>
                                </Card>
                                <Card className="bg-slate-900/60 border-rose-500/20 p-8 text-center rounded-3xl shadow-2xl group transition-all hover:bg-rose-500/5">
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Absent Count</p>
                                    <p className="text-5xl font-black italic tracking-tighter text-rose-500">{Object.values(selectedStudent.attendance).filter(v => v === 'absent').length}</p>
                                </Card>
                                <Card className="bg-primary p-8 text-center rounded-3xl shadow-[0_15px_40px_rgba(59,130,246,0.3)]">
                                    <p className="text-[10px] font-black text-primary-foreground uppercase tracking-widest opacity-80 mb-2">Consistency Score</p>
                                    <p className="text-5xl font-black italic tracking-tighter text-white">
                                        {((Object.values(selectedStudent.attendance).filter(v => v === 'present').length / (Object.keys(selectedStudent.attendance).length || 1)) * 100).toFixed(1)}%
                                    </p>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <Card className="bg-slate-900/60 border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
                                    <h4 className="text-xs font-black mb-10 flex items-center gap-2 text-primary uppercase tracking-[0.4em]">
                                        <BarChart3 className="h-5 w-5" /> TREND ANALYSIS (6 MO)
                                    </h4>
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={studentChartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontWeight: 'bold'}} />
                                                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.4)', fontWeight: 'bold'}} />
                                                <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff'}} />
                                                <Bar dataKey="present" fill="#38A3A5" radius={[6, 6, 0, 0]} barSize={24} />
                                                <Bar dataKey="absent" fill="#D98E5B" radius={[6, 6, 0, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                <Card className="bg-slate-900/60 border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
                                    <h4 className="text-xs font-black mb-10 flex items-center gap-2 text-primary uppercase tracking-[0.4em]">
                                        <PieIcon className="h-5 w-5" /> STATUS DISTRIBUTION
                                    </h4>
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={studentPieData}
                                                    cx="50%" cy="50%"
                                                    innerRadius={80} outerRadius={120}
                                                    paddingAngle={8} dataKey="value"
                                                    stroke="none"
                                                >
                                                    {studentPieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)'}} />
                                                <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '30px', fontWeight: 'black', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-slate-600 border border-dashed border-white/5 rounded-[3rem] bg-slate-900/20">
                            <User className="h-20 w-20 mb-6 opacity-10" />
                            <p className="text-2xl font-black uppercase italic tracking-widest">Select a Student to View Profile</p>
                            <p className="text-sm font-medium uppercase tracking-[0.3em] mt-2 opacity-50">Use the filters above to browse student records.</p>
                        </div>
                    )}
                </TabsContent>
            </div>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
