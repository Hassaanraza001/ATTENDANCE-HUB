
"use client";

import * as React from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Power, 
  RotateCcw, 
  Wifi, 
  Terminal, 
  Copy, 
  Link2Off, 
  Database, 
  Link, 
  Loader2, 
  Thermometer,
  Fingerprint,
  Cpu,
  Activity,
  Zap,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, doc, query, where, getDocs, limit, updateDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type HardwareStatus = {
  cpu_temp: number;
  last_online: any;
  status: string;
  hardware_ready: boolean;
  templates_stored: number;
  hardware_error?: string;
  deviceId: string;
  userId?: string;
  pairing_token?: string;
};

type DeviceCenterDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
};

export function DeviceCenterDialog({ isOpen, onOpenChange, userId }: DeviceCenterDialogProps) {
  const { toast } = useToast();
  const [activeDevice, setActiveDevice] = React.useState<HardwareStatus | null>(null);
  const [pairingInput, setPairingInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [confirmUnpair, setConfirmUnpair] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !userId) return;
    const db = getDb();
    const q = query(collection(db, "system_status"), where("userId", "==", userId), limit(1));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveDevice(snapshot.docs[0].data() as HardwareStatus);
      } else {
        setActiveDevice(null);
      }
    });
    return () => unsubscribe();
  }, [isOpen, userId]);

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmUnpair(false);
      setPairingInput("");
    }
  }, [isOpen]);

  const handleClaim = async () => {
    if (pairingInput.length !== 6) return;
    setIsLoading(true);
    try {
      const db = getDb();
      const q = query(collection(db, "system_status"), where("pairing_token", "==", pairingInput.trim()), limit(1));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const deviceDoc = snap.docs[0];
        await updateDoc(doc(db, "system_status", deviceDoc.id), {
          userId: userId,
          pairing_token: null
        });
        toast({ title: "Device Linked Successfully!", description: "Your BioSync Box is now paired." });
        setPairingInput("");
      } else {
        toast({ variant: "destructive", title: "Invalid Token", description: "Check the code on your device display." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Linking Error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpair = async () => {
    if (!activeDevice || !confirmUnpair) return;
    setIsLoading(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, "system_status", activeDevice.deviceId), {
        userId: null,
        pairing_token: Math.floor(100000 + Math.random() * 900000).toString()
      });
      
      toast({ title: "Device Unpaired", description: "You can now link a new device." });
      setActiveDevice(null);
      setConfirmUnpair(false);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Failed to unpair device" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendCommand = async (type: "SHUTDOWN" | "REBOOT") => {
    if (!activeDevice) return;
    try {
      const db = getDb();
      await addDoc(collection(db, "kiosk_commands"), {
        type,
        userId,
        deviceId: activeDevice.deviceId,
        status: "pending",
        timestamp: serverTimestamp()
      });
      toast({ title: "Command Sent" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send command" });
    }
  };

  const isOnline = activeDevice && (new Date().getTime() - (activeDevice.last_online?.toDate().getTime() || 0) < 70000);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none bg-slate-950 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-3xl h-[90vh] flex flex-col">
        <DialogHeader className="p-10 bg-slate-900 border-b border-white/5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Zap className="h-4 w-4 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">OS Level access</span>
            </div>
            <DialogTitle className="text-4xl font-black italic tracking-tighter text-white flex items-center gap-4">
              <Terminal className="text-primary h-10 w-10" />
              DEVICE <span className="text-primary">TERMINAL</span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-medium">
              Hardware management and pairing console for BioSync Standalone Units.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-10 space-y-10">
            {!activeDevice ? (
              <div className="space-y-10 py-6">
                 <div className="text-center space-y-4">
                    <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-2xl mb-6">
                      <Link className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">No Device Linked</h3>
                    <p className="text-slate-500 text-sm font-medium">Please enter the 6-digit authentication token displayed on your BioSync Box screen.</p>
                 </div>
                 <div className="flex flex-col gap-4">
                    <div className="relative">
                      <Input 
                        placeholder="XXXXXX" 
                        className="h-20 text-4xl font-black tracking-[0.8em] text-center bg-slate-900/80 border-white/10 text-white rounded-3xl focus:ring-primary focus:border-primary shadow-inner" 
                        value={pairingInput}
                        onChange={e => setPairingInput(e.target.value)}
                        maxLength={6}
                      />
                    </div>
                    <Button onClick={handleClaim} disabled={isLoading || pairingInput.length < 6} className="h-16 text-xl font-black uppercase italic bg-primary hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                      {isLoading ? <Loader2 className="animate-spin" /> : "ESTABLISH LINK"}
                    </Button>
                 </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 text-center group hover:border-emerald-500/30 transition-all">
                    <Wifi className={cn("h-8 w-8 mx-auto mb-3 transition-colors", isOnline ? "text-emerald-400" : "text-rose-500")} />
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Status</p>
                    <p className={cn("text-xs font-black uppercase tracking-widest", isOnline ? "text-emerald-400" : "text-rose-500")}>{isOnline ? "ACTIVE" : "OFFLINE"}</p>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 text-center group hover:border-orange-500/30 transition-all">
                    <Thermometer className="h-8 w-8 text-orange-400 mx-auto mb-3" />
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Thermal</p>
                    <p className="text-sm font-black text-white">{activeDevice?.cpu_temp ? activeDevice.cpu_temp.toFixed(1) : "--"}°C</p>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 text-center group hover:border-emerald-500/30 transition-all">
                    <Fingerprint className={cn("h-8 w-8 mx-auto mb-3", activeDevice?.hardware_ready ? "text-emerald-400" : "text-rose-500")} />
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Sensor</p>
                    <p className={cn("text-xs font-black uppercase tracking-widest", activeDevice?.hardware_ready ? "text-emerald-400" : "text-rose-500")}>{activeDevice?.hardware_ready ? "READY" : "ERROR"}</p>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-[2rem] border border-white/5 text-center group hover:border-primary/30 transition-all">
                    <Database className="h-8 w-8 text-primary mx-auto mb-3" />
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Templates</p>
                    <p className="text-sm font-black text-white">{activeDevice?.templates_stored || 0}</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 space-y-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Cpu className="h-16 w-16" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">HARDWARE SERIAL IDENTIFIER</p>
                  <div className="flex items-center justify-between">
                      <span className="font-mono text-primary text-2xl font-black italic tracking-tighter">{activeDevice.deviceId}</span>
                      <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-primary/20 hover:text-primary transition-all rounded-xl" onClick={() => navigator.clipboard.writeText(activeDevice.deviceId)}><Copy className="h-5 w-5" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <Button variant="outline" className="h-24 flex flex-col gap-2 bg-slate-900/50 border-white/10 text-white hover:bg-orange-500/10 hover:border-orange-500/30 rounded-[2rem] transition-all group" onClick={() => sendCommand("REBOOT")} disabled={!isOnline}>
                    <RotateCcw className="h-8 w-8 text-orange-400 group-hover:rotate-180 transition-transform duration-700" />
                    <span className="text-[10px] font-black uppercase italic tracking-widest">Restart System</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex flex-col gap-2 bg-slate-900/50 border-white/10 text-white hover:bg-rose-500/10 hover:border-rose-500/30 rounded-[2rem] transition-all group" onClick={() => sendCommand("SHUTDOWN")} disabled={!isOnline}>
                    <Power className="h-8 w-8 text-rose-500 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase italic tracking-widest">Power Down</span>
                  </Button>
                </div>

                <div className="pt-4 pb-10 space-y-6">
                  <div className="flex items-start space-x-3 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                    <Checkbox 
                      id="confirm-unpair" 
                      checked={confirmUnpair} 
                      onCheckedChange={(checked) => setConfirmUnpair(checked === true)}
                      className="mt-1 border-rose-500/50 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="confirm-unpair"
                        className="text-xs font-black uppercase italic tracking-tight text-rose-200 cursor-pointer select-none"
                      >
                        I understand that unlinking will reset this device
                      </label>
                      <p className="text-[9px] text-rose-500/60 font-bold uppercase tracking-widest">
                        The device will generate a new pairing token and stop syncing data.
                      </p>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className={cn(
                      "w-full h-16 border-white/5 bg-white/5 text-slate-500 rounded-2xl font-black italic uppercase tracking-widest transition-all",
                      confirmUnpair && "text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20"
                    )}
                    onClick={handleUnpair}
                    disabled={isLoading || !confirmUnpair}
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Link2Off className="mr-3 h-5 w-5" />}
                    BREAK LINK WITH THIS DEVICE
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
