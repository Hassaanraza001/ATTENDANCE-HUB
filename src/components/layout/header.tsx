
"use client"

import { 
  CalendarCheck, 
  LogOut, 
  Settings, 
  ShieldCheck,
  User,
  LifeBuoy,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

type HeaderProps = {
  children?: React.ReactNode;
  userEmail?: string | null;
  onProfileClick?: () => void;
  onResetSensor?: () => void;
  userName?: string;
}

export function Header({ children, userEmail, onProfileClick, onResetSensor, userName }: HeaderProps) {
  const { toast } = useToast();
  const auth = getAuthInstance();
  const [isResetAlertOpen, setIsResetAlertOpen] = React.useState(false);

  const getInitials = (text: string) => {
    if (!text) return 'U';
    return text.substring(0, 2).toUpperCase();
  }

  const showDiagnostics = () => {
    toast({
        title: "BioSync OS Diagnostics",
        description: (
            <div className="space-y-3 p-2 bg-black/20 rounded-lg border border-white/5 font-mono text-[10px] uppercase tracking-tighter mt-2">
                <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-muted-foreground">Kernel Status:</span>
                    <span className="text-emerald-500 font-black">v2.8.5 PRO ACTIVE</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-muted-foreground">Link Encryption:</span>
                    <span className="text-primary font-black">AES-256 GCM</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-muted-foreground">Sync Latency:</span>
                    <span className="text-emerald-500 font-black">0.42 ms</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Security Protocol:</span>
                    <span className="text-orange-500 font-black">BIO-STRICT v4</span>
                </div>
            </div>
        )
    })
  }

  const handleTerminalSync = () => {
    toast({
        title: "Re-Syncing Terminal",
        description: "Flushing local cache and handshaking with BioSync hardware...",
    });
    setTimeout(() => {
        window.location.reload();
    }, 1500);
  }

  const handleReportIssue = () => {
    window.open('https://forms.gle/vmJvdixfVNzEZrGw5', '_blank');
  }

  return (
    <header className="sticky top-0 z-[60] w-full border-b border-white/5 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-xl border border-primary/20">
            <CalendarCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground tracking-tighter uppercase italic">
            Attendance <span className="text-primary">HUB</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {children}
          
          <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
                  <Settings className="h-5 w-5 text-white/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-slate-950 border-white/10 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl">
                <DropdownMenuLabel className="flex items-center gap-3 p-3 mb-2 bg-white/5 rounded-xl border border-white/5">
                   <Avatar className="h-10 w-10 border border-primary/30">
                     <AvatarFallback className="bg-primary/20 text-primary font-black italic">{getInitials(userName || userEmail || '')}</AvatarFallback>
                   </Avatar>
                   <div className='flex flex-col min-w-0'>
                      <span className="text-sm font-black text-white italic uppercase tracking-tighter">Account</span>
                      <span className="text-[10px] text-muted-foreground truncate font-mono">{userEmail}</span>
                   </div>
                </DropdownMenuLabel>
                
                <DropdownMenuItem 
                  onClick={onProfileClick}
                  className="rounded-lg h-10 gap-3 focus:bg-white/10 transition-all cursor-pointer"
                >
                    <User className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Profile Control</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/5 my-2" />

                <DropdownMenuItem onClick={showDiagnostics} className="rounded-lg h-10 gap-3 focus:bg-emerald-500/10 focus:text-emerald-400 transition-all cursor-pointer group">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">System Diagnostics</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleTerminalSync} className="rounded-lg h-10 gap-3 focus:bg-primary/10 focus:text-primary transition-all cursor-pointer group">
                    <RefreshCw className="h-4 w-4 text-primary group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-xs font-black uppercase tracking-widest">Terminal Re-Sync</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  className="rounded-lg h-10 gap-3 focus:bg-destructive/10 focus:text-destructive transition-all cursor-pointer group" 
                  onClick={() => setIsResetAlertOpen(true)}
                >
                    <Trash2 className="h-4 w-4 text-destructive group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Reset Sensor Memory</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  className="rounded-lg h-10 gap-3 focus:bg-white/10 transition-all cursor-pointer" 
                  onClick={handleReportIssue}
                >
                    <LifeBuoy className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Report an issue</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/5 my-2" />
                
                <DropdownMenuItem 
                  onClick={() => auth.signOut()} 
                  className="rounded-lg h-10 gap-3 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400 transition-all cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialogContent className="bg-slate-950 border-white/10 rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white font-black italic uppercase flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" />
                  CRITICAL: FACTORY RESET
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  This action will permanently <span className="text-rose-500 font-bold">DELETE ALL FINGERPRINTS</span> from the Raspberry Pi sensor. Students will need to re-enroll. Are you absolutely sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">CANCEL</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    onResetSensor?.();
                    setIsResetAlertOpen(false);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black italic uppercase"
                >
                  ERASE EVERYTHING
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  );
}
