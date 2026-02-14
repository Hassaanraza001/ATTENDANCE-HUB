
"use client"

import { CalendarCheck, LogOut, Moon, Sun, Laptop, Settings, User, LifeBuoy, Keyboard } from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
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
  DropdownMenuGroup,
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
        title: "Keyboard Shortcuts",
        description: (
            <ul className="list-disc pl-5">
                <li><span className="font-semibold">Ctrl + S:</span> Start Attendance</li>
                <li><span className="font-semibold">Ctrl + E:</span> End & Analyze</li>
                <li><span className="font-semibold">Ctrl + A:</span> Add New Student</li>
            </ul>
        )
    })
  }

  return (
    <header className="sticky top-0 z-10 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground font-headline tracking-tight">
            Attendance HUB
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {children}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                 <Avatar className="h-8 w-8">
                   <AvatarFallback className="bg-primary/20 text-primary font-semibold">{getInitials(userEmail || '')}</AvatarFallback>
                 </Avatar>
                 <div className='flex flex-col'>
                    <span className="text-sm font-medium text-foreground">Account</span>
                    <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
                 </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="ml-2">Appearance</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Light</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Dark</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Laptop className="mr-2 h-4 w-4" />
                        <span>System</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
               <DropdownMenuGroup>
                 <DropdownMenuItem onClick={showShortcuts}>
                    <Keyboard className="mr-2 h-4 w-4" />
                    <span>Keyboard shortcuts</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                    <a href="mailto:support@attendancehub.com">
                        <LifeBuoy className="mr-2 h-4 w-4" />
                        <span>Report an issue</span>
                    </a>
                 </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => auth.signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
