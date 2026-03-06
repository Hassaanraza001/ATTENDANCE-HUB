
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/lib/types";
import { updateUserProfile } from "@/services/firestore";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, User, Building2, Phone, Zap, ChevronLeft, ShieldCheck, Mail } from "lucide-react";

const profileFormSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters."),
  instituteName: z.string().min(2, "Institute name must be at least 2 characters."),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits."),
});

type ProfileSettingsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  profile: UserProfile | null;
  onRefresh: () => void;
};

export function ProfileSettingsDialog({
  isOpen, onOpenChange, profile, onRefresh
}: ProfileSettingsDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      instituteName: "",
      phoneNumber: "",
    },
  });

  React.useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName || "",
        instituteName: profile.instituteName || "",
        phoneNumber: profile.phoneNumber ? profile.phoneNumber.replace('+91', '') : "",
      });
    }
  }, [profile, form, isOpen]);

  const handleFormSubmit = (values: z.infer<typeof profileFormSchema>) => {
    if (!profile) return;
    startTransition(async () => {
      try {
        const payload = { ...values, phoneNumber: `+91${values.phoneNumber}` };
        await updateUserProfile(profile.id, payload);
        toast({ title: "Profile Updated", description: "Your changes have been saved to BioSync Cloud." });
        onRefresh();
        onOpenChange(false);
      } catch (error) {
        toast({ title: "Update Failed", description: String(error), variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem] outline-none">
        <DialogHeader className="px-10 pt-24 pb-8 border-b border-white/5 bg-slate-900/50 backdrop-blur-3xl relative shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 left-8 z-[160] h-10 px-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl flex items-center gap-2 text-primary hover:text-primary/80 transition-all active:scale-95 shadow-lg"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">BACK</span>
          </button>

          <div className="pt-8 space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Identity Control Center</span>
            </div>
            <DialogTitle className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
                PROFILE <span className="text-primary">TERMINAL</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-medium text-sm">
              Configure your institutional identity and administrator credentials.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-10 space-y-10 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
              <div className="md:col-span-4 space-y-6">
                <Card className="bg-slate-900/40 border-white/5 p-6 rounded-3xl text-center space-y-4">
                  <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-2xl">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black italic text-white uppercase tracking-tighter">{profile?.displayName || "Admin User"}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{profile?.email}</p>
                  </div>
                </Card>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl space-y-2">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">System Access Level</p>
                  <p className="text-sm font-bold text-white uppercase italic">SUPER ADMINISTRATOR</p>
                </div>
              </div>

              <div className="md:col-span-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                      <FormField
                        control={form.control}
                        name="instituteName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Institute / School Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Building2 className="absolute left-4 top-3.5 h-5 w-5 text-primary/50" />
                                <Input placeholder="e.g. BioSync Academy" {...field} className="h-12 pl-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl focus:border-primary" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Admin Full Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-4 top-3.5 h-5 w-5 text-primary/50" />
                                <Input placeholder="e.g. John Doe" {...field} className="h-12 pl-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-xl focus:border-primary" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Admin Phone Number</FormLabel>
                            <FormControl>
                              <div className="flex items-center">
                                <span className="inline-flex items-center px-5 text-sm font-black bg-slate-800 border border-r-0 border-white/5 rounded-l-xl h-12 text-primary">
                                  +91
                                </span>
                                <div className="relative flex-1">
                                  <Phone className="absolute left-4 top-3.5 h-5 w-5 text-primary/50" />
                                  <Input placeholder="1234567890" {...field} className="h-12 pl-12 bg-slate-800/50 border-white/5 text-white font-bold rounded-l-none rounded-r-xl focus:border-primary" />
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-slate-500" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Authentication Node</span>
                          <span className="text-sm font-bold text-white/60">{profile?.email}</span>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                        Security Note: Email address is managed via the core authentication module and cannot be modified here.
                      </p>
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full h-16 bg-primary hover:bg-primary/90 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                      {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                      COMMIT CHANGES TO CLOUD
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
