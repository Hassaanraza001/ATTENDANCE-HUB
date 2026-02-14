
"use client";

import * as React from "react";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Power, RotateCcw, Activity, Thermometer, Wifi, ShieldAlert, Terminal, Hash, Copy, Link2Off, Fingerprint, Database, Link, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, doc, query, where, getDocs, limit, updateDoc } from "firebase/firestore";

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

  // Find the device linked to this user
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
        toast({ title: "Device Linked Successfully!", description: "Your Attendance Box is now paired." });
        setPairingInput("");
      } else {
        toast({ variant: "destructive", title: "Invalid Token", description: "Check the code on your Pi screen." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Linking Error" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendCommand = async (type: "SHUTDOWN" | "REBOOT" | "RESET_PAIRING") => {
    if (!activeDevice) return;
    try {
      const db = getDb();
      await addDoc(collection(db, "kiosk_commands"), {
        type,
        userId,
        deviceId: activeDevice.deviceId,
        status: "pending",
        createdAt: serverTimestamp()
      });
      toast({ title: "Command Sent" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send command" });
    }
  };

  // Increased tolerance to 70s to accommodate 30s heartbeat interval with some jitter
  const isOnline = activeDevice && (new Date().getTime() - (activeDevice.last_online?.toDate().getTime() || 0) < 70000);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-none bg-slate-950">
        <DialogHeader className="p-8 bg-slate-900 border-b border-white/5">
          <DialogTitle className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-3">
            <Terminal className="text-primary h-8 w-8" />
            DEVICE CENTER
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Link and manage your professional Raspberry Pi hardware.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8">
          {!activeDevice ? (
            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
               <div className="text-center py-10 space-y-4">
                  <Link className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-black text-white italic uppercase">No Device Linked</h3>
                  <p className="text-slate-400 text-sm">Enter the 6-digit code shown on your Pi display.</p>
               </div>
               <div className="flex gap-4">
                  <Input 
                    placeholder="Enter Pairing Code" 
                    className="h-16 text-2xl font-black tracking-[0.5em] text-center bg-slate-900 border-white/10" 
                    value={pairingInput}
                    onChange={e => setPairingInput(e.target.value)}
                    maxLength={6}
                  />
                  <Button onClick={handleClaim} disabled={isLoading || pairingInput.length < 6} className="h-16 px-8 bg-primary font-black uppercase italic">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Link Device"}
                  </Button>
               </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                  <Wifi className={isOnline ? "h-6 w-6 text-emerald-400 mx-auto mb-2" : "h-6 w-6 text-rose-500 mx-auto mb-2"} />
                  <p className="text-[10px] font-black uppercase text-slate-500">Link</p>
                  <p className={isOnline ? "text-sm font-bold text-emerald-400" : "text-sm font-bold text-rose-500"}>{isOnline ? "ONLINE" : "OFFLINE"}</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                  <Thermometer className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase text-slate-500">Temp</p>
                  <p className="text-sm font-bold text-white">{activeDevice?.cpu_temp?.toFixed(1) || "--"}°C</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                  <Fingerprint className={activeDevice?.hardware_ready ? "h-6 w-6 text-emerald-400 mx-auto mb-2" : "h-6 w-6 text-rose-500 mx-auto mb-2"} />
                  <p className="text-[10px] font-black uppercase text-slate-500">Sensor</p>
                  <p className={activeDevice?.hardware_ready ? "text-sm font-bold text-emerald-400" : "text-sm font-bold text-rose-500"}>{activeDevice?.hardware_ready ? "READY" : "ERROR"}</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                  <Database className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase text-slate-500">Stored</p>
                  <p className="text-sm font-bold text-white">{activeDevice?.templates_stored || 0}</p>
                </div>
              </div>

              <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Hardware Serial</p>
                <div className="flex items-center justify-between">
                    <span className="font-mono text-primary text-xl font-bold">{activeDevice.deviceId}</span>
                    <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(activeDevice.deviceId)}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-900 border-white/5 text-white hover:bg-orange-500/10" onClick={() => sendCommand("REBOOT")} disabled={!isOnline}>
                  <RotateCcw className="h-6 w-6 text-orange-400" />
                  <span className="text-xs font-bold uppercase italic">Restart</span>
                </Button>
                <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-900 border-white/5 text-white hover:bg-rose-500/10" onClick={() => sendCommand("SHUTDOWN")} disabled={!isOnline}>
                  <Power className="h-6 w-6 text-rose-500" />
                  <span className="text-xs font-bold uppercase italic">Shutdown</span>
                </Button>
              </div>

              <Button variant="outline" className="w-full h-16 border-white/10 text-white/40 hover:text-rose-400" onClick={() => sendCommand("RESET_PAIRING")} disabled={!isOnline}>
                <Link2Off className="mr-3 h-5 w-5" /> UNPAIR THIS DEVICE
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
