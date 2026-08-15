import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ScanResult = { value: string; format?: string };
type Props = { open: boolean; onClose: () => void; onDetected: (result: ScanResult) => void; title?: string; continuous?: boolean };

export function BarcodeScanner({ open, onClose, onDetected, title = "Scan barcode or QR code", continuous = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);
  const armedRef = useRef(true);
  const [error, setError] = useState("");
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let clearArmTimer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (clearArmTimer) clearTimeout(clearArmTimer);
    };
    const start = async () => {
      setError("");
      armedRef.current = true;
      const Detector = (window as any).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera scanning is not supported here. You can still use a USB/Bluetooth scanner or type the code manually.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track: MediaStreamTrack) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "code_93", "codabar", "itf", "upc_a", "upc_e", "data_matrix"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const first = codes?.[0];
            const value = first?.rawValue?.trim();
            if (value) {
              if (armedRef.current) {
                armedRef.current = false;
                onDetectedRef.current({ value, format: first?.format });
                if (!continuous) { stop(); return; }
              }
              if (clearArmTimer) clearTimeout(clearArmTimer);
              clearArmTimer = setTimeout(() => { armedRef.current = true; }, 500);
            } else if (continuous) {
              armedRef.current = true;
            }
          } catch { /* keep scanning */ }
          if (!cancelled) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not access the camera.");
      }
    };
    void start();
    return () => { cancelled = true; stop(); };
  }, [open, continuous]);

  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />{title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {error ? <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{error}</div> : <div className="overflow-hidden rounded-xl border bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>}
        <p className="text-center text-xs text-muted-foreground">Point the camera at a barcode or QR code. {continuous ? "Move the code away and scan again to increase quantity." : "The code is detected automatically."}</p>
        <Button variant="outline" className="w-full" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
