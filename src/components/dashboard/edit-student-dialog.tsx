
"use client";

import { useEffect } from "react";
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
import { Loader2 } from "lucide-react";

const studentFormSchema = z.object({
  rollNo: z.coerce.number().min(1, "Roll number is required."),
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits."),
  className: z.string().min(3, "Class name must be at least 3 characters."),
  fingerprintID: z.string().min(1, "Fingerprint ID cannot be empty."),
});

type EditStudentDialogProps = {
  student: Student | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onStudentUpdated: (student: Student) => void;
  isUpdating: boolean;
};

export function EditStudentDialog({
  student,
  isOpen,
  onOpenChange,
  onStudentUpdated,
  isUpdating,
}: EditStudentDialogProps) {
  const form = useForm<z.infer<typeof studentFormSchema>>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      className: "",
      fingerprintID: "",
      rollNo: 0,
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        name: student.name || "",
        phone: student.phone ? student.phone.replace('+91', '') : "",
        className: student.className || "",
        fingerprintID: student.fingerprintID || "",
        rollNo: student.rollNo || 0,
      });
    }
  }, [student, form]);

  function onSubmit(values: z.infer<typeof studentFormSchema>) {
    if (!student) return;
    const updatedStudent = {
      ...student,
      ...values,
      phone: `+91${values.phone}`,
    };
    onStudentUpdated(updatedStudent);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isUpdating) {
        onOpenChange(open)
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Update the student's details below. Country code +91 will be added automatically for the phone number.
          </DialogDescription>
        </DialogHeader>
        {student && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rollNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Roll No.</FormLabel>
                    <FormControl>
                       <Input type="number" placeholder="e.g. 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Doe" {...field} />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                       <div className="flex items-center">
                        <span className="inline-flex items-center px-3 text-sm text-gray-500 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 h-10">
                            +91
                        </span>
                        <Input placeholder="1234567890" {...field} className="rounded-l-none" />
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
                      <Input placeholder="e.g. Grade 10A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fingerprintID"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fingerprint ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
