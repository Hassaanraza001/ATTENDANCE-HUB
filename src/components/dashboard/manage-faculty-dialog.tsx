
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
import { Loader2, Trash2, Pencil, UserPlus, Users, ChevronLeft, Zap } from "lucide-react";

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
      <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem] outline-none">
        <DialogHeader className="px-10 pt-24 pb-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 left-8 z-[160] h-10 px-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl flex items-center gap-2 text-primary hover:text-primary/80 transition-all active:scale-95 shadow-lg"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">BACK</span>
          </button>

          <div className="pt-8 space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-orange-500">
                <Zap className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Notification roster access</span>
            </div>
            <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
                <Users className="h-8 w-8 text-orange-500" />
                FACULTY <span className="text-orange-500">NODE</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-medium text-sm">
              Add, edit, or remove faculty members who will receive summary SMS notifications.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-10 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <h3 className="text-2xl font-black italic uppercase tracking-widest text-white border-l-4 border-primary pl-4">
                      {editingFaculty ? "Modify Node" : "Register Node"}
                    </h3>
                    <Card className="bg-slate-900/40 border-white/5 p-8 rounded-3xl shadow-inner">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                                <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Dr. Sharma" {...field} className="h-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl focus:border-primary" />
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
                                        <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Role / Designation</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Principal, HOD" {...field} className="h-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl focus:border-primary" />
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
                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Phone Number</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center">
                                            <span className="inline-flex items-center px-5 text-sm font-black bg-slate-800 border border-r-0 border-white/5 rounded-l-xl h-12 text-primary">
                                                +91
                                            </span>
                                            <Input placeholder="1234567890" {...field} className="h-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-l-none rounded-r-xl focus:border-primary" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <div className="flex gap-4 pt-4">
                                    <Button type="submit" disabled={isPending} className="flex-1 h-14 bg-primary hover:bg-primary/90 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                                        {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                                        {editingFaculty ? "SAVE CHANGES" : "REGISTER NODE"}
                                    </Button>
                                    {editingFaculty && (
                                        <Button variant="ghost" onClick={() => setEditingFaculty(null)} className="rounded-2xl h-14 uppercase font-black tracking-widest text-[10px] text-slate-500 border border-white/5 px-6">CANCEL</Button>
                                    )}
                                </div>
                            </form>
                        </Form>
                    </Card>
                </div>
                <div className="space-y-8">
                    <h3 className="text-2xl font-black italic uppercase tracking-widest text-white border-l-4 border-orange-500 pl-4">
                      Active Nodes
                    </h3>
                    <Card className="rounded-[2.5rem] overflow-hidden border-white/5 bg-slate-900/40 shadow-2xl">
                        <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                                {faculties.length > 0 ? (
                                    faculties.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-6 border-b border-white/5 last:border-b-0 group hover:bg-white/5 transition-all">
                                            <div className="space-y-1">
                                                <p className="text-lg font-black italic tracking-tighter text-white uppercase">{f.name}</p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">{f.role}</span>
                                                    <span className="text-white/20">•</span>
                                                    <span className="text-xs font-mono font-bold text-slate-500">{f.phone}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingFaculty(f)} disabled={isPending} className="h-10 w-10 rounded-xl hover:bg-primary/20 hover:text-primary border border-transparent hover:border-primary/30">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-500/20 hover:text-rose-400 border border-transparent hover:border-rose-500/30" onClick={() => handleDelete(f.id)} disabled={isPending}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-10 space-y-6 opacity-20">
                                        <Users className="h-24 w-24" />
                                        <p className="text-sm font-black uppercase tracking-[0.5em]">No nodes detected in roster</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
