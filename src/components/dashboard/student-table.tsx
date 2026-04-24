
import type { Student } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { CalendarDays, Trash2, Pencil, Loader2, Send, Fingerprint, Check, X, RefreshCw } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

type StudentTableProps = {
  students: Student[];
  attendanceMode: boolean;
  attendanceType: 'biometric' | 'manual';
  onManualMark: (studentId: string, status: 'present' | 'absent') => void;
  onViewHistory: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  onEnroll: (student: Student) => void;
  isLoading: boolean;
  selectedDate: Date | undefined;
  onSendNotifications: () => void;
  attendanceTaken: boolean;
  isPending: boolean;
};

export function StudentTable({
  students,
  attendanceMode,
  attendanceType,
  onManualMark,
  onViewHistory,
  onEdit,
  onDelete,
  onEnroll,
  isLoading,
  selectedDate,
  onSendNotifications,
  attendanceTaken,
  isPending,
}: StudentTableProps) {
  
  const TableContent = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i} className={i % 2 === 0 ? "bg-muted/50" : ""}>
          <TableCell><Skeleton className="h-5 w-8" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-28" /></TableCell>
           <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
          <TableCell className="text-right" colSpan={2}><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
      ));
    }

    if (students.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
            No students found in this class. Add a new student to get started.
          </TableCell>
        </TableRow>
      );
    }
    
    return students.map((student, index) => {
      const isEnrolled = student.fingerprintID && student.fingerprintID !== 'NOT_ENROLLED';
      const displayRollNo = isNaN(Number(student.rollNo)) ? 0 : student.rollNo;

      const renderStatusCell = () => {
        if (attendanceMode && attendanceType === 'manual') {
          return (
            <div className="flex gap-1 justify-center">
              <Button
                size="sm"
                variant={student.status === 'present' ? 'success' : 'outline'}
                onClick={() => onManualMark(student.id, 'present')}
                className="h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={student.status === 'absent' ? 'destructive' : 'outline'}
                onClick={() => onManualMark(student.id, 'absent')}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        
        if (!isEnrolled) {
            return (
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 px-3 text-[9px] font-black uppercase italic border-primary/40 text-primary hover:bg-primary hover:text-white"
                    onClick={() => onEnroll(student)}
                >
                    <Fingerprint className="h-3 w-3 mr-1" /> Enroll
                </Button>
            );
        }

        return student.status ? (
          <Badge variant={student.status === 'absent' ? "destructive" : "success"} className="font-black italic uppercase text-[9px] px-3">
            {student.status}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-black text-slate-600 uppercase text-[9px] px-3">N/A</Badge>
        );
      };

      return (
        <TableRow 
            key={student.id} 
            className={cn(index % 2 === 0 ? "bg-muted/50" : "bg-card", "transition-colors h-16 border-white/5")}
        >
          <TableCell className="font-black text-primary italic text-sm">{displayRollNo}</TableCell>
          <TableCell className="font-black uppercase italic tracking-tighter text-white">{student.name}</TableCell>
          <TableCell className="hidden sm:table-cell text-muted-foreground font-bold uppercase text-[10px] tracking-widest">{student.className}</TableCell>
          <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-[10px]">{student.phone}</TableCell>
          <TableCell className="text-center">
            {renderStatusCell()}
          </TableCell>
          <TableCell className="text-right">
             <div className="flex items-center justify-end gap-2">
                {!isEnrolled && (
                    <Button 
                        size="sm" 
                        className="h-8 bg-primary hover:bg-primary/90 text-white font-black italic uppercase text-[9px]"
                        onClick={() => onEnroll(student)}
                    >
                        Enroll Finger
                    </Button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-white" disabled={attendanceMode}>
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-950 border-white/10 text-white rounded-xl p-2 shadow-2xl">
                    <DropdownMenuItem onSelect={() => onViewHistory(student)} className="rounded-lg h-10 gap-3">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">View History</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(student)} className="rounded-lg h-10 gap-3">
                        <Pencil className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Edit Details</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEnroll(student)} className="rounded-lg h-10 gap-3">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Re-enroll Finger</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5 my-2" />
                    <DropdownMenuItem
                        onSelect={() => onDelete(student)}
                        className="rounded-lg h-10 gap-3 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Delete Node</span>
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
          </TableCell>
        </TableRow>
      );
    })
  };

  return (
    <Card className="bg-slate-900/40 border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
      <CardHeader className="bg-slate-800/20 pb-4">
        <CardTitle className="text-white font-black italic uppercase tracking-tighter">Student Roster</CardTitle>
        <CardDescription className="text-slate-400 text-xs">
          List of students. Use "Enroll Finger" to register biometric templates for new nodes.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-800/50 hover:bg-slate-800/50 border-white/5 h-14">
                <TableHead className="w-[80px] font-black text-slate-500 uppercase text-[10px] tracking-widest pl-6">Roll</TableHead>
                <TableHead className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Name</TableHead>
                <TableHead className="hidden sm:table-cell font-black text-slate-500 uppercase text-[10px] tracking-widest">Class</TableHead>
                <TableHead className="hidden md:table-cell font-black text-slate-500 uppercase text-[10px] tracking-widest">Phone</TableHead>
                <TableHead className="text-center w-[150px] font-black text-slate-500 uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="text-right w-[200px] font-black text-slate-500 uppercase text-[10px] tracking-widest pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableContent />
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {attendanceTaken && (
        <CardFooter className="flex justify-end p-6 border-t border-white/5 bg-black/20">
            <Button onClick={onSendNotifications} disabled={isPending} className="bg-primary hover:bg-primary/90 font-black italic uppercase rounded-xl h-12 px-8 shadow-lg shadow-primary/20">
                {isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Notifications
            </Button>
        </CardFooter>
      )}
    </Card>
  );
}
