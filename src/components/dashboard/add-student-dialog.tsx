
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Student } from "@/lib/types";
import { Loader2, Fingerprint, CheckCircle2, AlertCircle, UserPlus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";

const studentFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits."),
  className: z.string().min(1, "Class name is required."),
});

type AddStudentDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onStudentAdded: (student: Omit<Student, "id" | "attendance" | "rollNo" | "userId" | "fingerprintID">) => Promise<Student | null>;
  isAdding: boolean;
  allStudents: Student[];
  studentToEnroll: Student | null;
  onEnroll: (student: Student) => void;
  enrollmentStatus: string;
  arduinoStatus: { connected: boolean; message: string };
  appState: "idle" | "attending" | "enrolling";
};

export function AddStudentDialog({
  isOpen,
  onOpenChange,
  onStudentAdded,
  isAdding,
  allStudents,
  studentToEnroll,
  onEnroll,
  enrollmentStatus,
  arduinoStatus,
  appState,
}: AddStudentDialogProps) {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [justAdded, setJustAdded] = React.useState(false);
  
  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      className: "",
    },
  });
  
  // Reset when opening
  React.useEffect(() => {
    if (isOpen) {
      if (studentToEnroll) {
        setCurrentStep(2);
        setJustAdded(false);
      } else {
        setCurrentStep(1);
        setJustAdded(false);
        form.reset();
      }
    }
  }, [isOpen, studentToEnroll, form]);

  async function onSubmit(values: z.infer<typeof studentFormSchema>) {
    const isDuplicate = allStudents.some(student => student.phone === `+91${values.phone}`);
    if (isDuplicate) {
      form.setError("phone", { type: "manual", message: "A student with this phone number already exists." });
      return;
    }
    
    const newStudent = {
      ...values,
      phone: `+91${values.phone}`,
    };
    
    const addedStudent = await onStudentAdded(newStudent);
    if (addedStudent) {
      setJustAdded(true);
      // We stay on Step 1 but show success and a button to "Proceed to Enroll" or "Add Another"
    }
  }

  const renderStep1 = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase">
          {justAdded ? "Student Added!" : "Register Student Node"}
        </DialogTitle>
        <DialogDescription>
          {justAdded 
            ? "Details saved successfully. Roll number assigned automatically." 
            : "Enter student details to register in the local roster."}
        </DialogDescription>
      </DialogHeader>

      {justAdded ? (
        <div className="py-10 space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl flex flex-col items-center gap-4 text-center">
             <CheckCircle2 className="h-12 w-12 text-emerald-500" />
             <div className="space-y-1">
                <p className="text-lg font-black text-white uppercase italic">{form.getValues('name')}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Successfully registered</p>
             </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
              <Button onClick={() => setCurrentStep(2)} className="h-14 bg-primary hover:bg-primary/90 rounded-xl font-black italic uppercase">
                 <Fingerprint className="mr-2 h-5 w-5" /> Enroll Biometrics Now
              </Button>
              <Button variant="ghost" onClick={() => { setJustAdded(false); form.reset(); }} className="h-14 border border-white/5 rounded-xl font-black italic uppercase text-slate-500">
                 <UserPlus className="mr-2 h-5 w-5" /> Add Another Student
              </Button>
          </div>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Doe" {...field} disabled={isAdding} className="bg-slate-900/50 border-white/5 rounded-xl h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parent's Phone Number</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                        <span className="inline-flex items-center px-4 text-xs font-black bg-slate-800 border border-r-0 border-white/5 rounded-l-xl h-11 text-primary">
                            +91
                        </span>
                        <Input placeholder="1234567890" {...field} className="rounded-l-none rounded-r-xl h-11 bg-slate-900/50 border-white/5" disabled={isAdding}/>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="className"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-slate-500">Class Identifier</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Grade 10A" {...field} disabled={isAdding} className="bg-slate-900/50 border-white/5 rounded-xl h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isAdding} className="w-full h-12 bg-primary hover:bg-primary/90 font-black italic uppercase rounded-xl shadow-xl shadow-primary/20 transition-all">
                {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                ADD TO ROSTER
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </>
  );

  const isSuccess = enrollmentStatus === 'SUCCESS';
  const isError = enrollmentStatus?.includes('ERROR') || enrollmentStatus === 'MATCH_ERROR';

  const renderStep2 = () => (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl font-black italic tracking-tighter uppercase">Biometric Link <span className="text-primary">(Step 2)</span></DialogTitle>
        <DialogDescription>
          Linking student: <span className="font-bold text-white uppercase italic">{studentToEnroll?.name}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="my-6">
        <Card className={cn(
            "text-center p-8 border-2 border-dashed transition-all duration-500",
            isSuccess ? "bg-emerald-500/10 border-emerald-500/50" : (isError ? "bg-rose-500/10 border-rose-500/50" : "bg-slate-900/40 border-white/10")
        )}>
            <CardHeader className="p-0 mb-6">
                <CardTitle className="flex flex-col items-center justify-center gap-4">
                    {isSuccess ? (
                        <CheckCircle2 className="h-16 w-16 text-emerald-500 animate-in zoom-in duration-500" />
                    ) : isError ? (
                        <AlertCircle className="h-16 w-16 text-rose-500 animate-bounce" />
                    ) : (
                        <Fingerprint className={cn("h-16 w-16 text-primary", appState === 'enrolling' && "animate-pulse")} />
                    )}
                    <span className={cn(
                        "text-2xl font-black italic uppercase tracking-tighter",
                        isSuccess ? "text-emerald-500" : (isError ? "text-rose-500" : "text-slate-400")
                    )}>
                        {isSuccess ? 'LINK ESTABLISHED!' : isError ? 'LINK FAILED' : (appState === 'enrolling' ? 'SCANNING FINGER...' : 'READY FOR SCAN')}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="bg-black/40 px-4 py-3 rounded-xl border border-white/5">
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
                      {enrollmentStatus || "Waiting for hardware trigger..."}
                    </p>
                </div>
            </CardContent>
        </Card>
      </div>
      <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-4">
        {isSuccess ? (
            <Button onClick={() => onOpenChange(false)} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black italic uppercase rounded-2xl shadow-xl shadow-emerald-500/20">
                CLOSE NODE TERMINAL
            </Button>
        ) : (
            <Button 
              onClick={() => studentToEnroll && onEnroll(studentToEnroll)}
              disabled={!arduinoStatus.connected || appState === 'enrolling'}
              className="w-full h-14 bg-primary hover:bg-primary/90 font-black italic uppercase rounded-2xl shadow-xl shadow-primary/20"
            >
              {appState === 'enrolling' 
                ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                : <Fingerprint className="mr-2 h-5 w-5" />
              }
              {appState === 'enrolling' ? 'COMMUNICATING...' : 'START DUAL-FINGER SCAN'}
            </Button>
        )}
         <div className="flex items-center justify-center gap-3 py-2">
            <div className={cn("h-2 w-2 rounded-full", arduinoStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                SYSTEM STATUS: <span className={arduinoStatus.connected ? "text-emerald-500" : "text-rose-500"}>{arduinoStatus.message}</span>
            </p>
        </div>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-950 border-white/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="relative z-10">
            {currentStep === 1 ? renderStep1() : renderStep2()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
