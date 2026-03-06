"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import Link from "next/link";
import { Loader2, Mail, Lock, LogIn, AlertCircle, LifeBuoy } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuthInstance();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Welcome back to Attendance HUB!" });
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast({ title: "Email Required", description: "Please enter your email to receive reset link.", variant: "destructive" });
      return;
    }
    setIsResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast({ 
        title: "Reset Link Sent", 
        description: "Check your inbox. If you don't see it, please check your SPAM folder.",
      });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white mb-2">
          Attendance <span className="text-primary">HUB</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Secure Institutional Access</p>
      </div>

      <Card className="glass-card border-white/10 shadow-2xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="space-y-1 pt-8">
          <CardTitle className="text-2xl font-black italic tracking-tight uppercase flex items-center gap-2">
            <LogIn className="h-6 w-6 text-primary" />
            LOGIN <span className="text-primary">TERMINAL</span>
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium">
            Enter your credentials to access the console.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form onSubmit={handleSignIn} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@institution.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 h-11 bg-slate-900/50 border-white/5 rounded-xl focus:border-primary transition-all"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Password</Label>
                
                <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-950 border-white/10 rounded-3xl sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black italic tracking-tight uppercase">Reset <span className="text-primary">Password</span></DialogTitle>
                      <DialogDescription className="text-slate-400">
                        We'll send a secure password reset link to your registered email address.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex gap-3 items-start">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-200 font-medium leading-relaxed uppercase tracking-wider">
                          IMPORTANT: If you don't receive the email, please check your <span className="font-black underline">SPAM folder</span>.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="reset-email" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registered Email</Label>
                        <Input
                          id="reset-email"
                          placeholder="your-email@example.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="mt-2 h-11 bg-slate-900/50 border-white/5 rounded-xl"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleForgotPassword} disabled={isResetLoading} className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-black italic uppercase tracking-widest">
                        {isResetLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "SEND RESET LINK"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 h-11 bg-slate-900/50 border-white/5 rounded-xl focus:border-primary transition-all"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-black italic uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              AUTHORIZE ACCESS
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-8 bg-black/20 pt-6">
          <div className="text-center text-[11px] font-medium text-slate-500">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary font-black uppercase tracking-widest hover:underline ml-1">
              Create Node
            </Link>
          </div>
          <div className="flex items-center gap-2 justify-center text-[9px] font-bold text-slate-600 uppercase tracking-widest border-t border-white/5 w-full pt-4">
            <LifeBuoy className="h-3 w-3" />
            Support: <a href="mailto:attendancehubhelp@gmail.com" className="text-slate-400 hover:text-primary transition-colors underline decoration-primary/30 underline-offset-4">attendancehubhelp@gmail.com</a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
