
import { Button } from "@/components/ui/button";
import { UserPlus, Fingerprint, CheckSquare, Loader2, Search, Users, ChevronDown, BookCopy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DatePicker } from "../ui/date-picker";
import { Input } from "../ui/input";

type AttendanceType = 'biometric' | 'manual';

type AttendanceControlsProps = {
  appState: "idle" | "attending" | "enrolling";
  onAddStudentClick: () => void;
  onStartAttendanceClick: (type: AttendanceType) => void;
  onEndAttendanceClick: () => void;
  onManageFacultyClick: () => void;
  classNames: string[];
  selectedClass: string;
  onClassChange: (className: string) => void;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
  selectedDate,
  onDateChange,
  searchQuery,
  onSearchChange,
}: AttendanceControlsProps) {
  const isActionsDisabled = appState !== 'idle';
  
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
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isActionsDisabled}
          />
        </div>
        <DatePicker date={selectedDate} setDate={onDateChange} disabled={isActionsDisabled} />
        <Select value={selectedClass} onValueChange={onClassChange} disabled={isActionsDisabled}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Classes</SelectItem>
              {classNames.filter(name => !!name && name.trim() !== "").map(name => (
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
