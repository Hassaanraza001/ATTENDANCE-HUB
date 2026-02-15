
"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import { format } from "date-fns";
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
  ArrowRight
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

  const filteredData = React.useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    
    return students.filter(student => {
      const matchesClass = selectedClass === "All" || student.className === selectedClass;
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.rollNo?.toString().includes(searchQuery);
      return matchesClass && matchesSearch;
    }).map(student => ({
      ...student,
      status: student.attendance?.[dateKey] || "no-record"
    }));
  }, [students, selectedDate, selectedClass, searchQuery]);

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
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-3xl">
        <DialogHeader className="px-10 py-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
                <Zap className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Forensic attendance search</span>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
                        <SearchCode className="h-10 w-10 text-emerald-500" />
                        HISTORY <span className="text-emerald-500">AUDIT</span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 font-medium">
                        Instant lookup for any student record across the entire institution.
                    </DialogDescription>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-white/5 backdrop-blur-xl">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-white font-black italic uppercase tracking-tighter hover:bg-white/10">
                                <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
                                {selectedDate ? format(selectedDate, "PPP") : "Pick Date"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-900 border-white/10" align="end">
                            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="bg-slate-900 text-white" />
                        </PopoverContent>
                    </Popover>

                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="w-[180px] h-10 bg-white/5 border-white/10 rounded-xl text-white font-black italic uppercase tracking-tighter focus:ring-emerald-500">
                            <Filter className="mr-2 h-4 w-4 text-emerald-500" />
                            <SelectValue placeholder="All Classes" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                            <SelectItem value="All">All Classes</SelectItem>
                            {classNames.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-2">
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">SCOPE</span>
                    <span className="text-sm font-black text-white">{stats.total} TOTAL</span>
                </div>
                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-widest">PRESENT</span>
                    <span className="text-sm font-black text-emerald-500">{stats.present}</span>
                </div>
                <div className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/20 flex items-center justify-between">
                    <span className="text-[9px] font-black text-rose-500/50 uppercase tracking-widest">ABSENT</span>
                    <span className="text-sm font-black text-rose-500">{stats.absent}</span>
                </div>
                <div className="bg-slate-500/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">NO DATA</span>
                    <span className="text-sm font-black text-slate-400">{stats.missing}</span>
                </div>
            </div>
          </div>
        </DialogHeader>

        <div className="px-10 py-4 bg-slate-900/30 border-b border-white/5">
            <div className="relative">
                <Search className="absolute left-4 top-3 h-5 w-5 text-emerald-500/50" />
                <Input 
                    placeholder="Search by student name or roll number..." 
                    className="h-12 pl-12 bg-transparent border-none text-white placeholder:text-slate-600 focus-visible:ring-0 text-lg font-medium italic"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        <ScrollArea className="flex-1 px-10 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                {filteredData.length > 0 ? (
                    filteredData.map((student) => {
                        const roll = Number(student.rollNo);
                        const displayRollNo = isNaN(roll) ? 0 : roll;
                        
                        return (
                            <div 
                                key={student.id} 
                                className="group relative bg-slate-900/40 border border-white/5 rounded-2xl p-5 hover:border-emerald-500/30 transition-all duration-300"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500 font-black italic">
                                            {displayRollNo}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-emerald-400 transition-colors">
                                                {student.name}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                Class: {student.className}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {student.status === "present" ? (
                                            <Badge className="bg-emerald-500 text-white font-black italic uppercase tracking-widest text-[10px] px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] border-none">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Present
                                            </Badge>
                                        ) : student.status === "absent" ? (
                                            <Badge className="bg-rose-500 text-white font-black italic uppercase tracking-widest text-[10px] px-3 py-1 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.3)] border-none">
                                                <XCircle className="h-3 w-3 mr-1" /> Absent
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-white/10 text-slate-600 font-black italic uppercase tracking-widest text-[10px] px-3 py-1 rounded-full">
                                                NO RECORD
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-3 w-3 text-slate-600" />
                                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                                          VERIFIED AT {selectedDate ? format(selectedDate, "MMM dd") : "--"}
                                        </span>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-400 transition-all"
                                      onClick={() => onViewProfile?.(student)}
                                    >
                                        FULL PROFILE <ArrowRight className="ml-1 h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center space-y-4">
                        <div className="h-20 w-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                            <History className="h-10 w-10 text-slate-800" />
                        </div>
                        <p className="text-slate-600 font-black uppercase tracking-[0.4em]">No Records Found for this Query</p>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
