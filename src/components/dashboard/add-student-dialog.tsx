
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
import { Loader2, Fingerprint } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const studentFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits."),
  className: z.string().min(3, "Class name must be at least 3 characters."),
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
  
  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      className: "",
    },
  });
  
  // Reset state when dialog is opened or closed
  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => { // delay to allow animation to finish
        form.reset();
        setCurrentStep(1);
      }, 300);
    }
  }, [isOpen, form]);

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
      setCurrentStep(2); // Move to enrollment step
    }
  }

  const renderStep1 = () => (
    <>
      <DialogHeader>
        <DialogTitle>Add New Student (Step 1 of 2)</DialogTitle>
        <DialogDescription>
          Enter the student's details. The roll number will be assigned automatically.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. John Doe" {...field} disabled={isAdding} />
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
                <FormLabel>Parent's Phone Number</FormLabel>
                <FormControl>
                  <div className="flex items-center">
                      <span className="inline-flex items-center px-3 text-sm text-gray-500 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 h-10">
                          +91
                      </span>
                      <Input placeholder="1234567890" {...field} className="rounded-l-none" disabled={isAdding}/>
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
                <FormLabel>Class</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Grade 10A" {...field} disabled={isAdding} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={isAdding}>
              {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Go to Enroll
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const renderStep2 = () => (
    <>
      <DialogHeader>
        <DialogTitle>Enroll Fingerprint (Step 2 of 2)</DialogTitle>
        <DialogDescription>
          For student: <span className="font-semibold text-primary">{studentToEnroll?.name}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="my-6">
        <Card className="text-center p-6 border-dashed">
            <CardHeader className="p-0 mb-4">
                <CardTitle className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Fingerprint className="h-10 w-10 text-primary" />
                    {appState === 'enrolling' ? 'Enrollment in Progress...' : 'Ready to Enroll'}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <p className="text-muted-foreground h-10 flex items-center justify-center">
                  {enrollmentStatus || "Click the button below to start the enrollment process."}
                </p>
            </CardContent>
        </Card>
      </div>
      <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
        <Button 
          onClick={() => studentToEnroll && onEnroll(studentToEnroll)}
          disabled={!arduinoStatus.connected || appState === 'enrolling'}
          className="w-full"
        >
          {appState === 'enrolling' 
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Fingerprint className="mr-2 h-4 w-4" />
          }
          {appState === 'enrolling' ? 'Enrolling...' : 'Start Enrollment'}
        </Button>
         <p className="text-xs text-center text-muted-foreground">
            Device Status: 
            <span className={arduinoStatus.connected ? "text-green-500" : "text-destructive"}>
              {` ${arduinoStatus.message}`}
            </span>
        </p>
      </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {currentStep === 1 ? renderStep1() : renderStep2()}
      </DialogContent>
    </Dialog>
  );
}

    