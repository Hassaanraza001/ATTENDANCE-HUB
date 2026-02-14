
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Faculty } from "@/lib/types";
import { addFaculty, updateFaculty, deleteFaculty } from "@/services/firestore";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Pencil, UserPlus } from "lucide-react";

const facultyFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits."),
  role: z.string().min(3, "Role must be at least 3 characters."),
});

type ManageFacultyDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  faculties: Faculty[];
  onRefresh: () => void;
  userId: string;
};

export function ManageFacultyDialog({
  isOpen, onOpenChange, faculties, onRefresh, userId
}: ManageFacultyDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingFaculty, setEditingFaculty] = React.useState<Faculty | null>(null);

  const form = useForm<z.infer<typeof facultyFormSchema>>({
    resolver: zodResolver(facultyFormSchema),
    defaultValues: { name: "", phone: "", role: "" },
  });

  React.useEffect(() => {
    if (editingFaculty) {
      form.reset({
        name: editingFaculty.name,
        phone: editingFaculty.phone.replace('+91', ''),
        role: editingFaculty.role,
      });
    } else {
      form.reset({ name: "", phone: "", role: "" });
    }
  }, [editingFaculty, form]);

  const handleFormSubmit = (values: z.infer<typeof facultyFormSchema>) => {
    startTransition(async () => {
      try {
        const payload = { ...values, phone: `+91${values.phone}` };
        if (editingFaculty) {
          await updateFaculty(editingFaculty.id, payload);
          toast({ title: "Faculty Updated" });
        } else {
          await addFaculty({ ...payload, userId });
          toast({ title: "Faculty Added" });
        }
        setEditingFaculty(null);
        onRefresh();
      } catch (error) {
        toast({ title: "Operation Failed", description: String(error), variant: "destructive" });
      }
    });
  };

  const handleDelete = (facultyId: string) => {
    startTransition(async () => {
        try {
            await deleteFaculty(facultyId);
            toast({ title: "Faculty Removed" });
            onRefresh();
        } catch (error) {
            toast({ title: "Deletion Failed", description: String(error), variant: "destructive" });
        }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage Faculty</DialogTitle>
          <DialogDescription>
            Add, edit, or remove faculty members who will receive summary SMS notifications.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
            <div>
                <h3 className="text-lg font-medium mb-4">{editingFaculty ? "Edit Faculty" : "Add New Faculty"}</h3>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Dr. Sharma" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Role / Designation</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Principal, HOD" {...field} />
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
                        <div className="flex gap-2">
                         <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingFaculty ? "Save Changes" : "Add Faculty"}
                         </Button>
                         {editingFaculty && (
                            <Button variant="ghost" onClick={() => setEditingFaculty(null)}>Cancel</Button>
                         )}
                        </div>
                    </form>
                </Form>
            </div>
            <div>
                 <h3 className="text-lg font-medium mb-4">Existing Faculty</h3>
                <Card>
                    <CardContent className="p-0">
                         <ScrollArea className="h-72">
                            {faculties.length > 0 ? (
                                faculties.map(f => (
                                    <div key={f.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                        <div>
                                            <p className="font-semibold">{f.name} <span className="text-xs text-muted-foreground font-normal">({f.role})</span></p>
                                            <p className="text-sm text-muted-foreground">{f.phone}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => setEditingFaculty(f)} disabled={isPending}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)} disabled={isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground p-10">
                                    No faculty added yet.
                                </div>
                            )}
                         </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
