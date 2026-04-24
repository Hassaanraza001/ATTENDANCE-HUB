
"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import { format, startOfDay } from "date-fns";
import { 
  History, 
  Search, 
  Calendar as CalendarIcon, 
  User, 
  CheckCircle2, 
  XCircle, 
  Filter,
  SearchCode,
  Zap,
  ArrowRight,
  ChevronLeft,
  Users2
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type HistoryAuditDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  classNames: string[];
  onViewProfile?: (student: Student) => void;
};

export function HistoryAuditDialog({
  isOpen,
  onOpenChange,
  students,
  classNames,
  onViewProfile,
}: HistoryAuditDialogProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [selectedClass, setSelectedClass] = React.useState<string>("All");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const filteredData = React.useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const isPastDate = startOfDay(selectedDate) < startOfDay(new Date());
    
    return students.filter(student => {
      const matchesClass = selectedClass === "All" || student.className === selectedClass;
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.rollNo?.toString().includes(searchQuery);
      
      let status = student.attendance?.[dateKey] || "no-record";
      if (status === "no-record" && isPastDate) status = "absent";

      const matchesStatus = statusFilter === "all" || status === statusFilter;
      
      return matchesClass && matchesSearch && matchesStatus;
    }).map(student => {
      let status = student.attendance?.[dateKey] || "no-record";
      if (status === "no-record" && isPastDate) {
        status = "absent";
      }
      return {
        ...student,
        status
      };
    });
  }, [students, selectedDate, selectedClass, searchQuery, statusFilter]);

  const stats = React.useMemo(() => {
    return {
      total: filteredData.length,
      present: filteredData.filter(d => d.status === "present").length,
      absent: filteredData.filter(d => d.status === "absent").length,
      missing: filteredData.filter(d => d.status === "no-record").length,
    };
  }, [filteredData]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem]">
        <DialogHeader className="px-10 pt-24 pb-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 left-10 z-[160] h-10 px-5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-500 transition-all active:scale-95 shadow-lg"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[11px] font-black uppercase tracking-widest">BACK</span>
          </button>

          <div className="relative z-10 flex items-center justify-between mt-8">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-500 mb-1">
                    <Zap className="h-4 w-4 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Forensic audit terminal</span>
                </div>
                <DialogTitle className="text-5xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
                    <SearchCode className="h-10 w-10 text-emerald-500" />
                    HISTORY <span className="text-emerald-500">AUDIT</span>
                </DialogTitle>
                <DialogDescription className="hidden">Audit student attendance records across classes and dates.</DialogDescription>
            </div>
            
            <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-white/5">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                    <TabsList className="bg-transparent gap-2 h-10">
                        <TabsTrigger value="all" className="rounded-xl px-6 text-[10px] font-black uppercase italic data-[state=active]:bg-primary data-[state=active]:text-white">All</TabsTrigger>
                        <TabsTrigger value="present" className="rounded-xl px-6 text-[10px] font-black uppercase italic data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Present</TabsTrigger>
                        <TabsTrigger value="absent" className="rounded-xl px-6 text-[10px] font-black uppercase italic data-[state=active]:bg-rose-500 data-[state=active]:text-white">Absent</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-10 py-10 space-y-10">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5">
                <div className="max-w-md">
                    <p className="text-slate-400 font-medium text-lg leading-relaxed italic">
                        Instant database lookup for any student record. Filter by status to find specific entries.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-white/5 backdrop-blur-xl">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-12 px-6 bg-white/5 border border-white/10 rounded-xl text-white font-black italic uppercase tracking-tighter hover:bg-white/10 transition-all">
                                <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
                                {selectedDate ? format(selectedDate, "MMMM do, yyyy") : "Pick Date"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="end">
                            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="bg-slate-900 text-white" />
                        </PopoverContent>
                    </Popover>

                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="w-[200px] h-12 bg-white/5 border-white/10 rounded-xl text-white font-black italic uppercase tracking-tighter focus:ring-emerald-500">
                            <Filter className="mr-2 h-4 w-4 text-emerald-500" />
                            <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="All">All Classes</SelectItem>
                            {classNames.filter(n => !!n).map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-col justify-between group hover:border-primary/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">TOTAL FILTERED</span>
                    <span className="text-4xl font-black text-white italic tracking-tighter">{filteredData.length} NODES</span>
                </div>
                <div className="bg-emerald-500/5 rounded-3xl p-6 border border-emerald-500/20 flex flex-col justify-between group hover:bg-emerald-500/10 transition-all">
                    <span className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-4">MATCHED PRESENT</span>
                    <span className="text-4xl font-black text-emerald-500 italic tracking-tighter">{stats.present}</span>
                </div>
                <div className="bg-rose-500/5 rounded-3xl p-6 border border-rose-500/20 flex flex-col justify-between group hover:bg-rose-500/10 transition-all">
                    <span className="text-[10px] font-black text-rose-500/50 uppercase tracking-widest mb-4">MATCHED ABSENT</span>
                    <span className="text-4xl font-black text-rose-500 italic tracking-tighter">{stats.absent}</span>
                </div>
                <div className="bg-slate-500/5 rounded-3xl p-6 border border-white/5 flex flex-col justify-between opacity-60">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">NO RECORD CREATED</span>
                    <span className="text-4xl font-black text-slate-400 italic tracking-tighter">{stats.missing}</span>
                </div>
            </div>

            <div className="sticky top-0 z-[50] bg-slate-950/80 backdrop-blur-xl -mx-4 px-4 py-2">
                <div className="relative group">
                    <Search className="absolute left-6 top-5 h-6 w-6 text-emerald-500/50 group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                        placeholder="Search by student name or roll number..." 
                        className="h-16 pl-16 bg-slate-900/60 border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 text-2xl font-bold italic rounded-3xl shadow-2xl transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {filteredData.length > 0 ? (
                    filteredData.map((student) => {
                        const roll = Number(student.rollNo);
                        const displayRollNo = isNaN(roll) ? 0 : roll;
                        
                        return (
                            <div 
                                key={student.id} 
                                className="group relative bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 hover:border-emerald-500/30 transition-all duration-500 shadow-xl overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all" />
                                
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <div className="flex items-center gap-6">
                                        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500 text-2xl font-black italic shadow-inner group-hover:scale-110 transition-transform">
                                            {displayRollNo}
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black italic tracking-tighter text-white uppercase group-hover:text-emerald-400 transition-colors leading-none mb-2">
                                                {student.name}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] bg-white/5 w-fit px-3 py-1 rounded-lg">
                                                Class: {student.className}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {student.status === "present" ? (
                                            <Badge className="bg-emerald-500 text-white font-black italic uppercase tracking-widest text-[10px] px-5 py-2 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.4)] border-none">
                                                <CheckCircle2 className="h-3 w-3 mr-2" /> Present
                                            </Badge>
                                        ) : student.status === "absent" ? (
                                            <Badge className="bg-rose-500 text-white font-black italic uppercase tracking-widest text-[10px] px-5 py-2 rounded-full shadow-[0_0_25px_rgba(244,63,94,0.4)] border-none">
                                                <XCircle className="h-3 w-3 mr-2" /> Absent
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-white/10 text-slate-600 font-black italic uppercase tracking-widest text-[10px] px-5 py-2 rounded-full">
                                                NO RECORD
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-6 border-t border-white/5 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500/50 animate-pulse" />
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                          AUDITED ON {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "--"}
                                        </span>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-10 px-6 text-[11px] font-black text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-400 transition-all rounded-xl group/btn shadow-lg"
                                      onClick={() => onViewProfile?.(student)}
                                    >
                                        VIEW ATTENDANCE HISTORY <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-40 text-center space-y-8 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/5">
                        <div className="h-32 w-32 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5 shadow-2xl relative">
                            <History className="h-16 w-16 text-slate-800" />
                            <div className="absolute inset-0 bg-emerald-500/5 rounded-full animate-ping" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-slate-600 font-black uppercase tracking-[0.5em] text-2xl">No Records Detected</p>
                            <p className="text-slate-700 text-sm font-bold uppercase tracking-widest">Try adjusting your filters or search query.</p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

