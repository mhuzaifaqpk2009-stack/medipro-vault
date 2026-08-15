import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ScanResult = { value: string; format?: string };
type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (result: ScanResult) => void;
  title?: string;
  continuous?: boolean;
  background?: boolean;
};

const EVENT_NAME = "medicore:barcode-scanned";

export function BarcodeScanner({ open, onClose, onDetected, title = "Scan barcode or QR code", continuous = false, background = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const keyboardRef = useRef({ value: "", startedAt: 0, lastAt: 0 });
  const [error, setError] = useState("");
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    let cancelled = false;
    let clearArmTimer: ReturnType<typeof setTimeout> | null = null;
    let cameraStarted = false;

    if (background) {
      (window as any).__medicoreGlobalScannerActive = true;
    } else if ((window as any).__medicoreGlobalScannerActive) {
      return;
    }

    const stop = () => {
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (clearArmTimer) clearTimeout(clearArmTimer);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const now = performance.now();
      const state = keyboardRef.current;
      if (event.key === "Enter") {
        const duration = state.startedAt ? now - state.startedAt : Infinity;
        const average = state.value.length > 1 ? duration / state.value.length : Infinity;
        const value = state.value.trim();
        keyboardRef.current = { value: "", startedAt: 0, lastAt: 0 };
        if (value.length >= 4 && duration <= 1000 && average <= 90) {
          onDetectedRef.current({ value, format: "keyboard" });
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key.length !== 1) return;
      if (!state.lastAt || now - state.lastAt > 180) keyboardRef.current = { value: event.key, startedAt: now, lastAt: now };
      else {
        state.value += event.key;
        state.lastAt = now;
      }
    };
    window.addEventListener("keydown", onKeyDown, true);

    const emitCameraResult = (value: string, format?: string) => {
      const clean = value.trim();
      if (clean) onDetectedRef.current({ value: clean, format });
    };

    const startZxing = async () => {
      try {
        if (!videoRef.current || cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanSuccess: continuous ? 700 : 250,
          delayBetweenScanAttempts: 150,
        });
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (!result || cancelled) return;
          const formatValue = result.getBarcodeFormat();
          emitCameraResult(result.getText(), formatValue === 11 ? "qr_code" : "zxing");
          if (!continuous) {
            controls.stop();
            zxingControlsRef.current = null;
          }
        });
        if (cancelled) controls.stop();
        else {
          zxingControlsRef.current = controls;
          cameraStarted = true;
        }
      } catch {
        // Camera is optional; hardware scanners still work.
      }
    };

    const startCamera = async () => {
      setError("");
      if (!videoRef.current) return;
      const Detector = (window as any).BarcodeDetector;
      if (Detector && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (cancelled) {
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            return;
          }
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          const detector = new Detector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "code_93", "codabar", "itf", "upc_a", "upc_e", "data_matrix"] });
          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              const first = codes?.[0];
              const value = first?.rawValue?.trim();
              if (value) {
                emitCameraResult(value, first?.format);
                if (!continuous) {
                  stop();
                  return;
                }
                if (clearArmTimer) clearTimeout(clearArmTimer);
                clearArmTimer = setTimeout(() => undefined, 500);
              }
            } catch {
              // Keep scanning silently.
            }
            if (!cancelled) requestAnimationFrame(tick);
          };
          cameraStarted = true;
          requestAnimationFrame(tick);
          return;
        } catch {
          stop();
        }
      }
      await startZxing();
      if (!cameraStarted && !background) setError("Camera scanning is unavailable. You can still use a USB/Bluetooth scanner or type the code manually.");
    };

    void startCamera();
    return () => {
      cancelled = true;
      stop();
      window.removeEventListener("keydown", onKeyDown, true);
      if (background) (window as any).__medicoreGlobalScannerActive = false;
    };
  }, [open, continuous, background]);

  if (background) {
    return <video ref={videoRef} className="pointer-events-none fixed -left-[10000px] top-0 h-px w-px opacity-0" muted playsInline aria-hidden="true" />;
  }
  if (typeof window !== "undefined" && (window as any).__medicoreGlobalScannerActive) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error ? <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{error}</div> : <div className="overflow-hidden rounded-xl border bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>}
          <p className="text-center text-xs text-muted-foreground">Point the camera at a barcode or QR code. {continuous ? "Move the code away and scan again to increase quantity." : "The code is detected automatically."}</p>
          <Button variant="outline" className="w-full" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function dispatchBarcodeScan(result: ScanResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: result }));
}

export { EVENT_NAME as BARCODE_SCAN_EVENT };
