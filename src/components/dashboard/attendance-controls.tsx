
"use client";

import { Button } from "@/components/ui/button";
import { UserPlus, Fingerprint, CheckSquare, Loader2, Search, Users, ChevronDown, BookCopy, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

type AttendanceType = 'biometric' | 'manual';

type AttendanceControlsProps = {
  appState: "idle" | "attending" | "enrolling";
  onAddStudentClick?: () => void;
  onStartAttendanceClick: (type: AttendanceType) => void;
  onEndAttendanceClick: () => void;
  onManageFacultyClick?: () => void;
  classNames?: string[];
  selectedClass?: string;
  onClassChange?: (className: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  compact?: boolean;
};

export function AttendanceControls({
  appState,
  onAddStudentClick,
  onStartAttendanceClick,
  onEndAttendanceClick,
  onManageFacultyClick,
  classNames,
  selectedClass,
  onClassChange,
  searchQuery,
  onSearchChange,
  compact = false,
}: AttendanceControlsProps) {
  const isActionsDisabled = appState !== 'idle';
  
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {appState === "attending" ? (
          <Button onClick={onEndAttendanceClick} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[170px] font-black italic uppercase rounded-xl">
            <CheckSquare className="mr-2 h-4 w-4" />
            End & Save
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={appState !== 'idle'} className="min-w-[170px] bg-primary hover:bg-primary/90 font-black italic uppercase rounded-xl">
                {appState === 'enrolling' ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Session
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-white">
              <DropdownMenuItem onClick={() => onStartAttendanceClick('biometric')} className="hover:bg-primary/20">
                <Fingerprint className="mr-2 h-4 w-4 text-primary" />
                Biometric Session
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartAttendanceClick('manual')} className="hover:bg-primary/20">
                <BookCopy className="mr-2 h-4 w-4 text-primary" />
                Manual Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex-1 w-full md:w-auto">
        <h2 className="text-xl font-semibold text-card-foreground">Dashboard Controls</h2>
        <p className="text-sm text-muted-foreground">Manage students, faculty, and attendance sessions.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name/phone..."
            className="pl-8 w-full md:w-[200px]"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            disabled={isActionsDisabled}
          />
        </div>
        <Select value={selectedClass} onValueChange={onClassChange} disabled={isActionsDisabled}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Classes</SelectItem>
              {classNames?.filter(name => !!name && name.trim() !== "").map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        <Button variant="outline" onClick={onAddStudentClick} disabled={appState !== 'idle'}>
          <UserPlus />
          Add Student
        </Button>
        <Button variant="outline" onClick={onManageFacultyClick} disabled={appState !== 'idle'}>
          <Users />
          Manage Faculty
        </Button>
        
        {appState === "attending" ? (
          <Button onClick={onEndAttendanceClick} className="bg-green-600 hover:bg-green-700 text-white min-w-[170px]">
            <CheckSquare />
            End & Save
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={appState !== 'idle'} className="min-w-[170px]">
                {appState === 'enrolling' ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  <>
                    Start Attendance
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onStartAttendanceClick('biometric')}>
                <Fingerprint className="mr-2 h-4 w-4" />
                Start Biometric Session
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartAttendanceClick('manual')}>
                <BookCopy className="mr-2 h-4 w-4" />
                Start Manual Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
