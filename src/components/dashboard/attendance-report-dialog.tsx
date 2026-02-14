
"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import { format, eachDayOfInterval, startOfDay, startOfMonth, endOfMonth, getYear, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import { Calendar as CalendarIcon, FileSpreadsheet, FileText, Users, CheckCircle, XCircle, TrendingUp, User, PieChart as PieIcon, BarChart3, Search, CalendarDays } from "lucide-react";
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
    const primaryColor = [56, 163, 165]; // Teal color from the app

    // 1. Header Section
    doc.setFontSize(26);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Attendance HUB", 14, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(80);
    doc.text(`Attendance Report: ${selectedClass === "All" ? "All Classes" : selectedClass}`, 14, 35);

    // Period Info
    let dateStr = "";
    if (reportType === 'range' && dateRange?.from && dateRange.to) {
        dateStr = `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`;
    } else if (selectedYear !== null && selectedMonth !== null) {
        dateStr = `${MONTHS[selectedMonth]} ${selectedYear}`;
    }
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Reporting Period: ${dateStr}`, 14, 42);

    // Separator line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);

    // 2. Executive Summary Section
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

    // 3. Detailed Attendance Log Section
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

    // 4. Footer & Page Numbers
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
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-primary">
                <TrendingUp className="h-6 w-6" />
                Attendance Analytics
              </DialogTitle>
              <DialogDescription className="text-sm">
                Detailed reports and visual insights for your institution.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-3 bg-muted/30 border-b flex flex-wrap items-center justify-between gap-4">
                <TabsList className="grid grid-cols-2 w-[320px]">
                    <TabsTrigger value="class-view" className="gap-2 text-sm">
                        <Users className="h-4 w-4" /> Class View
                    </TabsTrigger>
                    <TabsTrigger value="student-view" className="gap-2 text-sm">
                        <User className="h-4 w-4" /> Student View
                    </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-4">
                    <Select onValueChange={setSelectedClass} value={selectedClass || ""}>
                        <SelectTrigger className="w-[200px] text-sm">
                            <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
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
                                    className="pl-10 w-[220px] text-sm" 
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ""}>
                                <SelectTrigger className="w-[220px] text-sm">
                                    <SelectValue placeholder="Choose Student" />
                                </SelectTrigger>
                                <SelectContent>
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

            <ScrollArea className="flex-1">
                <TabsContent value="class-view" className="m-0 p-6 space-y-6 outline-none">
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border shadow-sm">
                        <div className="flex items-center gap-1 bg-muted/50 p-1.5 rounded-md">
                          <Button 
                            variant={reportType === 'range' ? "secondary" : "ghost"} 
                            size="sm" 
                            className="h-9 text-sm"
                            onClick={() => setReportType('range')}
                          >
                            Range
                          </Button>
                          <Button 
                            variant={reportType === 'monthly' ? "secondary" : "ghost"} 
                            size="sm" 
                            className="h-9 text-sm"
                            onClick={() => setReportType('monthly')}
                          >
                            Monthly
                          </Button>
                        </div>

                        {reportType === 'range' ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-10 w-[280px] justify-start text-left font-normal text-sm">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "PP")} - ${format(dateRange.to, "PP")}` : format(dateRange.from, "PP")) : "Select Dates"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <div className="flex gap-3 w-[280px]">
                                <Select onValueChange={(v) => setSelectedYear(Number(v))} value={String(selectedYear)}>
                                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>{getYears().map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select onValueChange={(v) => setSelectedMonth(Number(v))} value={String(selectedMonth)}>
                                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button onClick={handleGenerateReport} disabled={!selectedClass} className="h-10 px-8 text-sm">Generate Report</Button>
                        
                        <div className="ml-auto flex gap-3">
                            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!reportData} className="h-10 text-sm border-green-200 hover:bg-green-50">
                              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportToPDF} disabled={!reportData} className="h-10 text-sm border-red-200 hover:bg-red-50">
                              <FileText className="mr-2 h-4 w-4" /> Export PDF
                            </Button>
                        </div>
                    </div>

                    {reportData ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="bg-primary/5 border-primary/20 shadow-none">
                                    <CardContent className="p-5 flex flex-col justify-center">
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <CalendarDays className="h-4 w-4" /> Total Working Days
                                      </p>
                                      <p className="text-3xl font-bold text-primary">{totalWorkingDays}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/60 shadow-none">
                                    <CardContent className="p-5 flex flex-col justify-center">
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <CheckCircle className="h-4 w-4" /> Avg. Attendance
                                      </p>
                                      <p className="text-3xl font-bold">{summaryStats?.avgAttendance.toFixed(1)}%</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/60 shadow-none">
                                    <CardContent className="p-5 flex flex-col justify-center">
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <TrendingUp className="h-4 w-4" /> Top Performer
                                      </p>
                                      <p className="text-xl font-bold truncate text-primary">{summaryStats?.topStudent.name}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-card border-border/60 shadow-none">
                                    <CardContent className="p-5 flex flex-col justify-center">
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <XCircle className="h-4 w-4" /> High Risk Students
                                      </p>
                                      <p className="text-xl font-bold truncate text-destructive">{summaryStats?.lowStudent.name}</p>
                                    </CardContent>
                                </Card>
                            </div>
                            <Card className="rounded-lg border shadow-none overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40 h-12">
                                            <TableHead className="w-[100px] text-xs uppercase font-bold tracking-wider">Roll No</TableHead>
                                            <TableHead className="text-xs uppercase font-bold tracking-wider">Student Name</TableHead>
                                            <TableHead className="text-center text-xs uppercase font-bold tracking-wider">Present</TableHead>
                                            <TableHead className="text-center text-xs uppercase font-bold tracking-wider">Absent</TableHead>
                                            <TableHead className="w-[240px] text-xs uppercase font-bold tracking-wider">Attendance Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.map((d) => (
                                            <TableRow key={d.studentId} className="h-14 hover:bg-muted/30">
                                                <TableCell className="py-3 text-sm font-medium">{d.rollNo}</TableCell>
                                                <TableCell className="py-3 text-sm font-bold">{d.name}</TableCell>
                                                <TableCell className="py-3 text-center text-primary font-bold text-base">{d.presentCount}</TableCell>
                                                <TableCell className="py-3 text-center text-destructive font-bold text-base">{d.absentCount}</TableCell>
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-4">
                                                        <Progress value={d.percentage} className="h-2.5 flex-1" />
                                                        <span className="text-sm font-bold min-w-[45px]">{d.percentage.toFixed(0)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                            <Users className="h-16 w-16 mb-4 opacity-10" />
                            <p className="text-xl font-semibold">Generate a report to see insights</p>
                            <p className="text-sm mt-2">Select a class and date range above.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="student-view" className="m-0 p-6 space-y-6 outline-none">
                    {selectedStudent ? (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="p-6 text-center border-border/60 bg-card shadow-none">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-2">Tracked Days</p>
                                    <p className="text-3xl font-bold">{Object.keys(selectedStudent.attendance).length}</p>
                                </Card>
                                <Card className="p-6 text-center border-primary/20 bg-primary/5 shadow-none">
                                    <p className="text-xs text-primary uppercase font-bold tracking-widest mb-2">Present Count</p>
                                    <p className="text-3xl font-bold text-primary">{Object.values(selectedStudent.attendance).filter(v => v === 'present').length}</p>
                                </Card>
                                <Card className="p-6 text-center border-destructive/20 bg-destructive/5 shadow-none">
                                    <p className="text-xs text-destructive uppercase font-bold tracking-widest mb-2">Absent Count</p>
                                    <p className="text-3xl font-bold text-destructive">{Object.values(selectedStudent.attendance).filter(v => v === 'absent').length}</p>
                                </Card>
                                <Card className="p-6 text-center bg-primary border-primary shadow-none text-primary-foreground">
                                    <p className="text-xs uppercase font-bold tracking-widest opacity-80 mb-2">Consistency Score</p>
                                    <p className="text-3xl font-bold">
                                        {((Object.values(selectedStudent.attendance).filter(v => v === 'present').length / (Object.keys(selectedStudent.attendance).length || 1)) * 100).toFixed(1)}%
                                    </p>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="p-6 shadow-none border-border/60">
                                    <h4 className="text-sm font-bold mb-6 flex items-center gap-2 text-primary uppercase tracking-widest">
                                        <BarChart3 className="h-5 w-5" /> Attendance Trend (Last 6 Months)
                                    </h4>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={studentChartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} />
                                                <YAxis fontSize={12} axisLine={false} tickLine={false} />
                                                <RechartsTooltip />
                                                <Bar dataKey="present" fill="#38A3A5" radius={[4, 4, 0, 0]} barSize={24} />
                                                <Bar dataKey="absent" fill="#D98E5B" radius={[4, 4, 0, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                <Card className="p-6 shadow-none border-border/60">
                                    <h4 className="text-sm font-bold mb-6 flex items-center gap-2 text-primary uppercase tracking-widest">
                                        <PieIcon className="h-5 w-5" /> Attendance Distribution
                                    </h4>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={studentPieData}
                                                    cx="50%" cy="50%"
                                                    innerRadius={70} outerRadius={100}
                                                    paddingAngle={6} dataKey="value"
                                                >
                                                    {studentPieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                                <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                            <User className="h-16 w-16 mb-4 opacity-10" />
                            <p className="text-xl font-semibold">Select a Student to View Profile</p>
                            <p className="text-sm mt-2">Use the filters above to browse student records.</p>
                        </div>
                    )}
                </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
