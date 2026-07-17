import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const data = useProjectStore((s) => s.data)!;
  const mutate = useProjectStore((s) => s.mutate);
  const save = useProjectStore((s) => s.save);
  const s = data.settings;

  const set = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) =>
    mutate((d) => {
      (d.settings as any)[key] = value;
    });

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your pharmacy details, taxes, and workspace behaviour.
          </p>
        </div>
        <Button
          className="ml-auto"
          onClick={async () => (await save()) && toast.success("Saved")}
        >
          <Save className="mr-2 h-4 w-4" /> Save now
        </Button>
      </header>

      <section className="surface-card p-6">
        <h2 className="font-display text-base font-semibold">Pharmacy details</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Appears on receipts and printed invoices.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Pharmacy name">
            <Input value={s.pharmacyName} onChange={(e) => set("pharmacyName", e.target.value)} />
          </Field>
          <Field label="Owner name">
            <Input value={s.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={s.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={s.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <Input value={s.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Billing</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Tax %">
            <Input
              type="number"
              value={s.taxPercent}
              onChange={(e) => set("taxPercent", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Currency code">
            <Input value={s.currency} onChange={(e) => set("currency", e.target.value)} />
          </Field>
          <Field label="Currency symbol">
            <Input
              value={s.currencySymbol}
              onChange={(e) => set("currencySymbol", e.target.value)}
            />
          </Field>
          <Field label="Receipt footer" className="md:col-span-3">
            <Input
              value={s.receiptFooter}
              onChange={(e) => set("receiptFooter", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-6">
        <h2 className="font-display text-base font-semibold">Auto save</h2>
        <p className="text-xs text-muted-foreground">
          Only runs after the project has a save location.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-3">
            <Switch
              checked={s.autoSaveEnabled}
              onCheckedChange={(v) => set("autoSaveEnabled", v)}
            />
            <span className="text-sm font-medium">Enable auto save</span>
          </label>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Interval</Label>
            <Select
              value={String(s.autoSaveIntervalMinutes)}
              onValueChange={(v) =>
                set("autoSaveIntervalMinutes", Number(v) as typeof s.autoSaveIntervalMinutes)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 5, 10, 15].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} minute{n === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
