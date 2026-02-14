
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
import { CalendarDays, Trash2, Pencil, Loader2, Send, Fingerprint, Check, X } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { format } from "date-fns";
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
      const dateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const statusForSelectedDate = student.attendance ? student.attendance[dateKey] : undefined;
      const isEnrolled = student.fingerprintID && student.fingerprintID !== 'NOT_ENROLLED';
      // Fix for NaN error: ensure rollNo is a valid number or fallback to 0
      const displayRollNo = isNaN(Number(student.rollNo)) ? 0 : student.rollNo;

      const renderStatusCell = () => {
        if (attendanceMode && attendanceType === 'manual') {
          return (
            <div className="flex gap-1 justify-center">
              <Button
                size="sm"
                variant={statusForSelectedDate === 'present' ? 'success' : 'outline'}
                onClick={() => onManualMark(student.id, 'present')}
                className="h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={statusForSelectedDate === 'absent' ? 'destructive' : 'outline'}
                onClick={() => onManualMark(student.id, 'absent')}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        }
        
        return statusForSelectedDate ? (
          <Badge variant={statusForSelectedDate === 'absent' ? "destructive" : "success"}>
            {statusForSelectedDate}
          </Badge>
        ) : (
          <Badge variant="outline">N/A</Badge>
        );
      };

      return (
        <TableRow 
            key={student.id} 
            className={cn(index % 2 === 0 ? "bg-muted/50" : "bg-card", "transition-colors")}
        >
          <TableCell className="font-medium">{displayRollNo}</TableCell>
          <TableCell className="font-medium">{student.name}</TableCell>
          <TableCell className="hidden sm:table-cell text-muted-foreground">{student.className}</TableCell>
          <TableCell className="hidden md:table-cell text-muted-foreground">{student.phone}</TableCell>
          <TableCell className="text-center">
            {renderStatusCell()}
          </TableCell>
          <TableCell className="text-right space-x-1">
            {!isEnrolled && (
              <Button variant="outline" size="sm" onClick={() => onEnroll(student)} disabled={attendanceMode}>
                <Fingerprint className="mr-2 h-4 w-4 text-primary" />
                Enroll
              </Button>
            )}
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0" disabled={attendanceMode}>
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewHistory(student)}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    <span>View History</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(student)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Edit Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(student)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Student</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </TableCell>
        </TableRow>
      );
    })
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Roster</CardTitle>
        <CardDescription>
          List of students for the selected class. Enroll fingerprints for new students from here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead className="w-[50px]">Roll</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Class</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="text-center w-[120px]">Status</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableContent />
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {attendanceTaken && (
        <CardFooter className="flex justify-end pt-6">
            <Button onClick={onSendNotifications} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Send SMS Notifications
            </Button>
        </CardFooter>
      )}
    </Card>
  );
}
