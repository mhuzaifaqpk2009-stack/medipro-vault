import { Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Target = HTMLInputElement | HTMLTextAreaElement;
const VOICE_LOCALES: Record<string, string> = { en: "en-US", ur: "ur-PK", hi: "hi-IN", bn: "bn-BD" };

function setInputValue(target: Target, value: string) {
  const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

function isSearch(el: Element): el is Target {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  const hint = `${el.placeholder || ""} ${el.getAttribute("aria-label") || ""} ${el.name || ""}`.toLowerCase();
  return hint.includes("search") || hint.includes("scan");
}

export function VoiceSearchOverlay() {
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [buttonPos, setButtonPos] = useState({ left: 0, top: 0 });
  const recognitionRef = useRef<any>(null);
  const targetRef = useRef<Target | null>(null);
  const transcriptRef = useRef("");
  targetRef.current = target;

  // Keep the microphone INSIDE the search field, not floating outside it.
  // The input gets extra right padding below so typed text never sits under it.
  const positionButton = () => {
    const el = targetRef.current;
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 36, Math.max(4, r.right - 36));
    const top = Math.min(window.innerHeight - 32, Math.max(4, r.top + (r.height - 32) / 2));
    setButtonPos({ left, top });
  };

  useEffect(() => {
    const decorate = () => document.querySelectorAll("input,textarea").forEach((node) => {
      if (!isSearch(node) || node.dataset.voiceBound === "1") return;
      node.dataset.voiceBound = "1";
      node.classList.add("pr-10");
      const update = () => { setTarget(node); targetRef.current = node; positionButton(); };
      node.addEventListener("focus", update);
      node.addEventListener("click", update);
    });
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    positionButton();
    const fn = () => positionButton();
    window.addEventListener("resize", fn);
    window.addEventListener("scroll", fn, true);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("scroll", fn, true); };
  }, [target]);

  useEffect(() => () => { try { recognitionRef.current?.abort(); } catch {} }, []);

  const close = () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    setOpen(false);
    setError("");
  };

  const start = async () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { setError("Voice recognition is not available in this application."); return; }
    transcriptRef.current = "";
    setTranscript("");
    setError("");
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (e: any) {
      const name = String(e?.name || "");
      setError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Microphone permission was denied. Allow microphone access for Huzaifa Pharmacy and try again."
        : "Microphone could not be opened. Check that a microphone is connected and available.");
      return;
    }

    const r = new Speech();
    recognitionRef.current = r;
    const code = localStorage.getItem("medicore.language") || "en";
    r.lang = VOICE_LOCALES[code] || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onerror = (e: any) => {
      setListening(false);
      const reason = String(e?.error || "");
      if (reason === "not-allowed") setError("Microphone access was blocked by the speech service. This Electron build may not support Chromium Web Speech recognition.");
      else if (reason === "network") setError("Speech recognition service is unavailable. Check your internet connection and try again.");
      else setError(reason ? `Voice recognition: ${reason}` : "Voice recognition could not start.");
    };
    r.onend = () => setListening(false);
    r.onresult = (event: any) => {
      let finalText = transcriptRef.current;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i]?.[0]?.transcript || "";
        if (event.results[i]?.isFinal) finalText = `${finalText} ${text}`.trim();
        else interim += text;
      }
      transcriptRef.current = finalText;
      setTranscript(`${finalText} ${interim}`.trim());
    };
    try { r.start(); } catch { setError("Voice recognition could not start. Try again."); }
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    const value = transcriptRef.current.trim() || transcript.trim();
    const currentTarget = targetRef.current;
    if (value && currentTarget) setInputValue(currentTarget, value);
    setOpen(false);
    currentTarget?.focus();
  };

  if (!target) return null;
  return <>
    <button type="button" aria-label="Voice search" title="Voice search" onMouseDown={(e) => e.preventDefault()} onClick={() => { setTarget(targetRef.current); setOpen(true); setTranscript(""); transcriptRef.current = ""; setError(""); }} className="fixed z-[180] grid h-8 w-8 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-accent" style={buttonPos}>
      <Mic className="h-4 w-4" />
    </button>
    {open && <div className="fixed inset-0 z-[190] grid place-items-center bg-background/60 p-4 backdrop-blur-sm">
      <div className="w-[min(460px,calc(100vw-32px))] rounded-2xl border bg-card p-7 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Voice search</div>
        <h2 className="mt-2 font-display text-2xl font-bold">{listening ? "Listening…" : "Ready to listen"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{listening ? "Speak naturally. Your words appear below the microphone." : "Click the microphone to start speaking."}</p>
        <button type="button" aria-label={listening ? "Stop listening" : "Start listening"} onMouseDown={(e) => e.preventDefault()} onClick={listening ? stop : start} className={`mx-auto mt-7 grid h-32 w-32 place-items-center rounded-full border-4 shadow-lg transition-transform ${listening ? "scale-105 border-primary bg-primary/15 text-primary" : "border-muted bg-muted/40 text-foreground hover:scale-105"}`}>
          {listening ? <MicOff className="h-12 w-12" /> : <Mic className="h-12 w-12" />}
        </button>
        <div className="mt-6 min-h-16 rounded-xl border bg-muted/20 p-4 text-left text-sm">{transcript || <span className="text-muted-foreground">What you say will appear here…</span>}</div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        <div className="mt-5 flex justify-center"><Button variant="outline" onClick={close}><X className="mr-2 h-4 w-4" />Close</Button></div>
      </div>
    </div>}
  </>;
}
