import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, text) => fs.writeFileSync(path.join(root, p), text, "utf8");
const replaceOnce = (text, from, to, label) => {
  if (!text.includes(from)) {
    if (text.includes(label)) return text;
    throw new Error(`HPMS build fix could not find ${label}`);
  }
  return text.replace(from, to);
};

const scanner = `import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ScanResult = { value: string; format?: string };
type Props = { open: boolean; onClose: () => void; onDetected: (result: ScanResult) => void; title?: string; continuous?: boolean };

export function BarcodeScanner({ open, onClose, onDetected, title = "Scan barcode or QR code", continuous = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastValueRef = useRef("");
  const lastDetectedAtRef = useRef(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    const start = async () => {
      setError("");
      lastValueRef.current = "";
      lastDetectedAtRef.current = 0;
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
              const now = Date.now();
              const duplicateTooSoon = value === lastValueRef.current && now - lastDetectedAtRef.current < 900;
              if (!duplicateTooSoon) {
                lastValueRef.current = value;
                lastDetectedAtRef.current = now;
                if (!continuous) stop();
                onDetected({ value, format: first?.format });
                if (!continuous) return;
              }
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
  }, [open, onDetected, continuous]);

  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />{title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        {error ? <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{error}</div> : <div className="overflow-hidden rounded-xl border bg-black"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>}
        <p className="text-center text-xs text-muted-foreground">Point the camera at a barcode or QR code. {continuous ? "Scanning stays active; scan again to increase quantity." : "The code is detected automatically."}</p>
        <Button variant="outline" className="w-full" onClick={onClose}><X className="mr-2 h-4 w-4" />Close</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
`;

const scannerPath = path.join(root, "src/components/BarcodeScanner.tsx");
const scannerCurrent = fs.readFileSync(scannerPath, "utf8");
if (!scannerCurrent.includes("continuous?: boolean")) fs.writeFileSync(scannerPath, scanner, "utf8");

let text = read("src/routes/app.prescriptions.tsx");
if (!text.includes("medicore?.print?.html")) {
  text = text.replace(/function printPrescription\(p: Prescription, data: any\) \{.*?\n\}\n\nconst emptyForm/s, `async function printPrescription(p: Prescription, data: any) {
  const rows = p.items.map((x) => {
    const m = data.medicines.find((medicine: any) => medicine.id === x.medicineId);
    return \`<tr><td>\${escapeHtml(m?.name ?? "—")}</td><td>\${x.quantity}</td><td>\${escapeHtml(x.dosage ?? "")}</td><td>\${escapeHtml(x.frequency ?? "")}</td><td>\${escapeHtml(x.duration ?? "")}</td><td>\${escapeHtml(x.instructions ?? "")}</td></tr>\`;
  }).join("");
  const html = \`<!doctype html><html><head><title>Prescription - \${escapeHtml(p.patientName)}</title><style>body{font-family:Arial;padding:28px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}.muted{color:#666}</style></head><body><h1>\${escapeHtml(data.settings.pharmacyName || data.meta.name)}</h1><p><b>Patient:</b> \${escapeHtml(p.patientName)}\${p.patientPhone ? \`<br><b>Phone:</b> \${escapeHtml(p.patientPhone)}\` : ""}\${p.doctorName ? \`<br><b>Doctor:</b> \${escapeHtml(p.doctorName)}\` : ""}\${p.diagnosis ? \`<br><b>Diagnosis:</b> \${escapeHtml(p.diagnosis)}\` : ""}<br><b>Prescription date:</b> \${escapeHtml(p.date.slice(0,10))}\${p.nextVisitDate ? \`<br><b>Next visit:</b> \${escapeHtml(p.nextVisitDate)}\` : ""}</p><table><thead><tr><th>Medicine</th><th>Qty</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>\${rows}</tbody></table>\${p.notes ? \`<p><b>Notes:</b> \${escapeHtml(p.notes)}</p>\` : ""}<p class="muted">Printed from HPMS</p></body></html>\`;
  const api = (typeof window !== "undefined" ? (window as any).medicore?.print?.html : null);
  if (api) {
    const result = await api(html);
    if (!result?.ok) toast.error(result?.error || "Could not print the prescription.");
    return;
  }
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return toast.error("Popup blocked. Allow popups to print the prescription.");
  w.document.write(\`\${html}<script>window.onload=()=>window.print();</script>\`);
  w.document.close();
}

const emptyForm`);
  text = text.replace('onClick={() => printPrescription(p, data)}', 'onClick={() => void printPrescription(p, data)}');
  write("src/routes/app.prescriptions.tsx", text);
}

text = read("src/routes/app.sales.tsx");
if (!text.includes('useEffect(() => { setScannerOpen(true); }, []);')) {
  text = replaceOnce(text, '  const [rxSearch, setRxSearch] = useState("");\n', '  const [rxSearch, setRxSearch] = useState("");\n  useEffect(() => { setScannerOpen(true); }, []);\n', 'sales scanner state');
  text = text.replace('    setScannerOpen(false);\n    add(med.id);\n  }, [data.medicines, cart]);', '    add(med.id);\n  }, [data.medicines, cart]);');
  text = text.replace('<BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={({ value }) => addScannedCode(value)} />', '<BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={({ value }) => addScannedCode(value)} continuous />');
  write("src/routes/app.sales.tsx", text);
}

text = read("src/routes/app.medicines.tsx");
if (!text.includes('setScanTarget("barcode");setScannerOpen(true)')) {
  const anchor = '  useEffect(()=>{if(!value||value.id)return;const onKey=(e:KeyboardEvent)=>{';
  const endMarker = '},[value,m,quickCombo,onSave]);';
  const start = text.indexOf(anchor);
  const end = start >= 0 ? text.indexOf(endMarker, start) : -1;
  if (start < 0 || end < 0) throw new Error("medicine editor hotkey effect");
  const endPos = end + endMarker.length;
  text = text.slice(0, endPos) + '\n  useEffect(()=>{if(!value||value.id)return;setScanTarget("barcode");setScannerOpen(true);},[value]);' + text.slice(endPos);
  const replacements = [
    ['<Input value={cur.name} onChange={(e)=>upd("name",e.target.value)} autoFocus />','<Input value={cur.name} onChange={(e)=>upd("name",e.target.value)} placeholder="Medicine name" autoFocus />'],
    ['<Input value={cur.genericName??""} onChange={(e)=>upd("genericName",e.target.value)} />','<Input value={cur.genericName??""} onChange={(e)=>upd("genericName",e.target.value)} placeholder="Generic name" />'],
    ['<Input value={cur.company??""} onChange={(e)=>upd("company",e.target.value)} />','<Input value={cur.company??""} onChange={(e)=>upd("company",e.target.value)} placeholder="Manufacturer / company" />'],
    ['<Input value={cur.batchNumber??""} onChange={(e)=>upd("batchNumber",e.target.value)} />','<Input value={cur.batchNumber??""} onChange={(e)=>upd("batchNumber",e.target.value)} placeholder="Batch number" />'],
    ['<Input value={cur.rackNumber??""} onChange={(e)=>upd("rackNumber",e.target.value)} />','<Input value={cur.rackNumber??""} onChange={(e)=>upd("rackNumber",e.target.value)} placeholder="Rack / shelf" />'],
    ['<Input type="number" value={cur.purchasePrice||""} onChange={(e)=>upd("purchasePrice",+e.target.value||0)} />','<Input type="number" value={cur.purchasePrice||""} onChange={(e)=>upd("purchasePrice",+e.target.value||0)} placeholder="0.00" />'],
    ['<Input type="number" value={cur.salePrice||""} onChange={(e)=>upd("salePrice",+e.target.value||0)} />','<Input type="number" value={cur.salePrice||""} onChange={(e)=>upd("salePrice",+e.target.value||0)} placeholder="0.00" />'],
    ['<Input type="number" value={cur.mrp||""} onChange={(e)=>upd("mrp",+e.target.value||0)} />','<Input type="number" value={cur.mrp||""} onChange={(e)=>upd("mrp",+e.target.value||0)} placeholder="0.00" />'],
    ['<Input type="number" value={cur.stockQuantity||""} onChange={(e)=>upd("stockQuantity",+e.target.value||0)} />','<Input type="number" value={cur.stockQuantity||""} onChange={(e)=>upd("stockQuantity",+e.target.value||0)} placeholder="0" />'],
    ['<Input type="number" value={cur.minimumStock||""} onChange={(e)=>upd("minimumStock",+e.target.value||0)} />','<Input type="number" value={cur.minimumStock||""} onChange={(e)=>upd("minimumStock",+e.target.value||0)} placeholder="5" />'],
  ];
  for (const [a,b] of replacements) text = text.replace(a,b);
  write("src/routes/app.medicines.tsx", text);
}

text = read("src/routes/app.suppliers.tsx");
if (!text.includes('placeholder="Supplier name"')) {
  const replacements = [
    ['<Input value={v.name} onChange={(e) => upd("name", e.target.value)} autoFocus />','<Input value={v.name} onChange={(e) => upd("name", e.target.value)} placeholder="Supplier name" autoFocus />'],
    ['<Input value={v.company ?? ""} onChange={(e) => upd("company", e.target.value)} />','<Input value={v.company ?? ""} onChange={(e) => upd("company", e.target.value)} placeholder="Company name" />'],
    ['<Input value={v.phone ?? ""} onChange={(e) => upd("phone", e.target.value)} />','<Input value={v.phone ?? ""} onChange={(e) => upd("phone", e.target.value)} placeholder="Phone number" />'],
    ['<Input value={v.email ?? ""} onChange={(e) => upd("email", e.target.value)} />','<Input value={v.email ?? ""} onChange={(e) => upd("email", e.target.value)} placeholder="Email address" />'],
    ['<Input value={v.address ?? ""} onChange={(e) => upd("address", e.target.value)} />','<Input value={v.address ?? ""} onChange={(e) => upd("address", e.target.value)} placeholder="Supplier address" />'],
    ['<Input type="number" value={v.balance || ""} onChange={(e) => upd("balance", +e.target.value || 0)} />','<Input type="number" value={v.balance || ""} onChange={(e) => upd("balance", +e.target.value || 0)} placeholder="0.00" />'],
  ];
  for (const [a,b] of replacements) text = text.replace(a,b);
  write("src/routes/app.suppliers.tsx", text);
}

text = read("src/routes/app.settings.tsx");
if (text.includes('<TabsList className="mb-4 flex flex-wrap">')) {
  text = text.replace('<TabsList className="mb-4 flex flex-wrap">','<TabsList className="mb-4 flex max-w-full flex-nowrap gap-1 overflow-x-auto whitespace-nowrap">');
  write("src/routes/app.settings.tsx", text);
}

console.log("HPMS build fixes applied");
