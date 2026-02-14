
"use client";

import * as React from "react";
import type { Student } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

type AttendanceCalendarDialogProps = {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function AttendanceCalendarDialog({ student, isOpen, onOpenChange }: AttendanceCalendarDialogProps) {
  if (!student) return null;

  const presentDays = Object.entries(student.attendance)
    .filter(([, status]) => status === 'present')
    .map(([date]) => new Date(date));

  const absentDays = Object.entries(student.attendance)
    .filter(([, status]) => status === 'absent')
    .map(([date]) => new Date(date));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance History for {student.name}</DialogTitle>
          <DialogDescription>
            Review the student's attendance record for the year.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center">
            <Calendar
                mode="multiple"
                selected={[...presentDays, ...absentDays]}
                modifiers={{
                    present: presentDays,
                    absent: absentDays,
                }}
                modifiersStyles={{
                    present: {
                        color: 'hsl(var(--primary-foreground))',
                        backgroundColor: 'hsl(var(--primary))',
                    },
                    absent: {
                        color: 'hsl(var(--destructive-foreground))',
                        backgroundColor: 'hsl(var(--destructive))',
                    }
                }}
                className="rounded-md border"
                numberOfMonths={1}
                defaultMonth={new Date()}
            />
        </div>
        <div className="flex justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-primary" />
                <span className="text-sm">Present</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-destructive" />
                <span className="text-sm">Absent</span>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
