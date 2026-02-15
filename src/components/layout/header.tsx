
"use client"

import { 
  CalendarCheck, 
  LogOut, 
  Moon, 
  Sun, 
  Laptop, 
  Settings, 
  Keyboard,
  User,
  LifeBuoy
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { getAuthInstance } from '@/lib/firebase';
import { useTheme } from 'next-themes';
import { useToast } from '@/hooks/use-toast';

type HeaderProps = {
  children?: React.ReactNode;
  userEmail?: string | null;
}

export function Header({ children, userEmail }: HeaderProps) {
  const { setTheme } = useTheme();
  const { toast } = useToast();
  const auth = getAuthInstance();

  const getInitials = (email: string) => {
    if (!email) return 'U';
    const name = email.split('@')[0];
    return name.substring(0, 2).toUpperCase();
  }

  const showShortcuts = () => {
    toast({
        title: "System Hotkeys",
        description: (
            <ul className="list-disc pl-5 text-[10px] font-bold uppercase tracking-tight">
                <li><span className="text-primary">Ctrl + S:</span> Start Attendance</li>
                <li><span className="text-primary">Ctrl + E:</span> End Session</li>
                <li><span className="text-primary">Ctrl + R:</span> Refresh Database</li>
            </ul>
        )
    })
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
                <Settings className="h-5 w-5 text-white/60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-slate-950 border-white/10 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <DropdownMenuLabel className="flex items-center gap-3 p-3 mb-2 bg-white/5 rounded-xl border border-white/5">
                 <Avatar className="h-10 w-10 border border-primary/30">
                   <AvatarFallback className="bg-primary/20 text-primary font-black italic">{getInitials(userEmail || '')}</AvatarFallback>
                 </Avatar>
                 <div className='flex flex-col min-w-0'>
                    <span className="text-sm font-black text-white italic uppercase tracking-tighter">Account</span>
                    <span className="text-[10px] text-muted-foreground truncate font-mono">{userEmail}</span>
                 </div>
              </DropdownMenuLabel>
              
              <DropdownMenuItem className="rounded-lg h-10 gap-3 focus:bg-white/10 transition-all cursor-pointer">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Profile</span>
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg h-10 gap-3 focus:bg-primary/10 focus:text-primary transition-all cursor-pointer">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="text-xs font-bold uppercase tracking-widest">Appearance</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="bg-slate-950 border-white/10">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="gap-3 text-xs font-bold uppercase">
                      <Sun className="h-4 w-4" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-3 text-xs font-bold uppercase">
                      <Moon className="h-4 w-4" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="gap-3 text-xs font-bold uppercase">
                      <Laptop className="h-4 w-4" /> System
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem onClick={showShortcuts} className="rounded-lg h-10 gap-3 focus:bg-white/10 transition-all cursor-pointer">
                  <Keyboard className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Keyboard shortcuts</span>
              </DropdownMenuItem>

              <DropdownMenuItem className="rounded-lg h-10 gap-3 focus:bg-white/10 transition-all cursor-pointer" onClick={() => toast({ title: "Feedback System", description: "This feature will be available in the next OS update." })}>
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
        </div>
      </div>
    </header>
  );
}
