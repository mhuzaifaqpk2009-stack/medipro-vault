import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Edit3, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { canEditMedicine, canDeleteMedicine } from "@/lib/granular-permissions";
import type { Medicine } from "@/domain/schema";

function rowMedicine(row: HTMLElement, medicines: Medicine[]) {
  const cell = row.querySelector("td:first-child > div") as HTMLElement | null;
  const text = cell?.textContent?.trim() || "";
  return medicines.find((m) => text === m.name || text.endsWith(m.name)) ?? null;
}

function medicineRows() { return Array.from(document.querySelectorAll<HTMLElement>("main tbody tr")); }

export function MedicineInteractionGuard() {
  const pathname = useLocation({ select: (s) => s.pathname });
  const navigate = useNavigate();
  const medicines = useProjectStore((s) => s.data?.medicines ?? []);
  const user = useSession((s) => s.user);
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [menu, setMenu] = useState<{ medicine: Medicine; x: number; y: number } | null>(null);
  const canEdit = useMemo(() => canEditMedicine(user), [user]);
  const canDelete = useMemo(() => canDeleteMedicine(user), [user]);
  const canSell = user?.role === "admin" || !!user?.permissions?.sales;

  useEffect(() => {
    if (pathname !== "/app/medicines") { setSelected(null); setMenu(null); return; }
    const onClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement)?.closest("main tbody tr") as HTMLElement | null;
      if (!row) return;
      const medicine = rowMedicine(row, medicines);
      if (medicine) { setSelected(medicine); setMenu(null); }
    };
    const onContext = (e: MouseEvent) => {
      const row = (e.target as HTMLElement)?.closest("main tbody tr") as HTMLElement | null;
      if (!row) return;
      const medicine = rowMedicine(row, medicines);
      if (!medicine) return;
      e.preventDefault(); e.stopPropagation();
      setSelected(medicine); setMenu({ medicine, x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 170) });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("contextmenu", onContext, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("contextmenu", onContext, true); };
  }, [pathname, medicines]);

  useEffect(() => {
    if (pathname !== "/app/medicines") return;
    for (const row of medicineRows()) {
      const m = rowMedicine(row, medicines);
      row.classList.toggle("ring-2", !!selected && !!m && m.id === selected.id);
      row.classList.toggle("ring-primary", !!selected && !!m && m.id === selected.id);
      row.classList.toggle("bg-primary/5", !!selected && !!m && m.id === selected.id);
    }
  }, [pathname, medicines, selected]);

  useEffect(() => {
    if (pathname !== "/app/medicines") return;
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      if (e.key === "F1") { e.preventDefault(); e.stopPropagation(); if (canEdit) clickRowAction(selected, "edit"); else toast.error("You do not have permission to edit medicines"); }
      if (e.key === "Delete") { e.preventDefault(); e.stopPropagation(); if (canDelete) clickRowAction(selected, "delete"); else toast.error("You do not have permission to delete medicines"); }
      if (e.key === "F6") { e.preventDefault(); e.stopPropagation(); if (canSell) loadToCart(selected); else toast.error("You do not have permission to use Sales / POS"); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pathname, selected, canEdit, canDelete, canSell]);

  const clickRowAction = (medicine: Medicine, action: "edit" | "delete") => {
    const row = medicineRows().find((r) => rowMedicine(r, medicines)?.id === medicine.id);
    if (!row) return;
    const buttons = Array.from(row.querySelectorAll<HTMLButtonElement>("button"));
    const button = action === "edit" ? (canEdit ? buttons[0] : undefined) : (canEdit && canDelete ? buttons[1] : canDelete ? buttons[0] : undefined);
    button?.click();
  };

  const loadToCart = (medicine: Medicine) => {
    if (!canSell) { toast.error("You do not have permission to use Sales / POS"); return; }
    const store = useCartStore.getState();
    store.setCart((prev) => { const i = prev.findIndex((line) => line.medicineId === medicine.id); if (i >= 0) return prev.map((line, index) => index === i ? { ...line, quantity: line.quantity + 1 } : line); return [{ medicineId: medicine.id, quantity: 1, salePrice: medicine.salePrice, discountPercent: 0, name: medicine.name, forced: false, forcedSale: false }, ...prev]; });
    setMenu(null); toast.success(`${medicine.name} loaded into cart`); void navigate({ to: "/app/sales" });
  };

  if (pathname !== "/app/medicines" || !menu) return null;
  return <div className="fixed inset-0 z-[120]" onMouseDown={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}><div role="menu" className="absolute min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-elevated" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}><div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{menu.medicine.name}</div>{canEdit && <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { setMenu(null); clickRowAction(menu.medicine, "edit"); }}><Edit3 className="h-4 w-4" />Edit medicine <span className="ml-auto text-xs text-muted-foreground">F1</span></button>}{canDelete && <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => { setMenu(null); clickRowAction(menu.medicine, "delete"); }}><Trash2 className="h-4 w-4 text-destructive" />Delete medicine <span className="ml-auto text-xs text-muted-foreground">Del</span></button>}{canSell && <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={() => loadToCart(menu.medicine)}><ShoppingCart className="h-4 w-4" />Load to cart <span className="ml-auto text-xs text-muted-foreground">F6</span></button>}</div></div>;
}
