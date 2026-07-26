import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Promise-based password prompt used to replace window.prompt() (which is
 * unavailable in Electron). Rendered once at the app root; other code calls
 * askPassword() to await user input.
 */
type Resolver = (value: string | null) => void;
let openFn: ((title: string, message?: string) => Promise<string | null>) | null = null;

export function askPassword(title = "Enter password", message?: string): Promise<string | null> {
  if (!openFn) return Promise.resolve(null);
  return openFn(title, message);
}

export function PasswordPromptHost() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Enter password");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [value, setValue] = useState("");
  const resolverRef = useRef<Resolver | null>(null);

  useEffect(() => {
    openFn = (t, m) => new Promise((resolve) => {
      setTitle(t); setMessage(m); setValue(""); setOpen(true);
      resolverRef.current = resolve;
    });
    return () => { openFn = null; };
  }, []);

  function close(result: string | null) {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); close(value); }} className="grid gap-3">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <Label className="text-xs">Password</Label>
          <Input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(null)}>Cancel</Button>
            <Button type="submit" disabled={!value}>OK</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
