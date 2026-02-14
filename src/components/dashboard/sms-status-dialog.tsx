"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";

type SmsStatusDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  messages: string[];
};

export function SmsStatusDialog({
  isOpen,
  onOpenChange,
  messages,
}: SmsStatusDialogProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        // Simple scroll to bottom
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal />
            Live SMS Sending Status
          </DialogTitle>
          <DialogDescription>
            This window shows live status updates from the Arduino as it sends SMS messages. Do not close this window until all messages are processed.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 bg-muted rounded-md p-4">
          <ScrollArea className="h-72 w-full font-mono text-xs" ref={scrollAreaRef}>
            {messages.length > 0 ? (
                messages.map((msg, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                        <span className="text-primary mr-2">{`>`}</span>
                        {msg}
                    </div>
                ))
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    Waiting for status updates...
                </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
