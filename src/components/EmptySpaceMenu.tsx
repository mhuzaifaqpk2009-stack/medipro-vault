import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useSession } from "@/store/session-store";
import { NAV, navLabel } from "@/lib/nav";
import { runQuickAction, type QuickActionId } from "@/lib/quick-actions";

type AddSpec = { label: string; quick?: QuickActionId; patterns: RegExp[] };
const ADD_BY_PATH: Record<string, AddSpec> = {
  "/app/medicines": { label: "Add medicine", quick: "new-medicine", patterns: [/add\s+medicine/i,/new\s+medicine/i] },
  "/app/purchases": { label: "New purchase", quick: "new-purchase", patterns: [/new\s+purchase/i,/add\s+purchase/i] },
  "/app/customers": { label: "Add customer", quick: "new-customer", patterns: [/add\s+customer/i,/new\s+customer/i] },
  "/app/suppliers": { label: "Add supplier", quick: "new-supplier", patterns: [/add\s+supplier/i,/new\s+supplier/i] },
  "/app/categories": { label: "Add category", patterns: [/add\s+categor/i,/new\s+categor/i] },
  "/app/racks": { label: "Add rack", patterns: [/add\s+rack/i,/new\s+rack/i] },
  "/app/prescriptions": { label: "Add prescription", patterns: [/add\s+prescription/i,/new\s+prescription/i] },
  "/app/stocktake": { label: "New stock take", patterns: [/new\s+stock\s+take/i,/start\s+stock\s+take/i,/add\s+stock\s+take/i] },
  "/app/messages": { label: "New message", patterns: [/new\s+message/i,/send\s+message/i] },
};
function isInteractive(target: EventTarget | null) { const el=target instanceof HTMLElement?target:null; return !!el?.closest('button,a,input,textarea,select,[role="button"],[role="tab"],[role="menu"],[role="dialog"]'); }
export function EmptySpaceMenu(){ const pathname=useRouterState({select:s=>s.location.pathname});const navigate=useNavigate();const data=useProjectStore(s=>s.data);const[open,setOpen]=useState(false);const[point,setPoint]=useState({x:0,y:0});useEffect(()=>{const main=document.querySelector("main");if(!main)return;const onContext=(e:MouseEvent)=>{if(isInteractive(e.target))return;e.preventDefault();setPoint({x:e.clientX,y:e.clientY});setOpen(true);};const close=()=>setOpen(false);window.addEventListener("click",close);window.addEventListener("resize",close);return()=>{main.removeEventListener("contextmenu",onContext);window.removeEventListener("click",close);window.removeEventListener("resize",close);};},[pathname]);const item=NAV.find(n=>n.to===pathname);const label=item?navLabel(item,data?.settings):pathname;const add=ADD_BY_PATH[pathname];const left=Math.min(point.x,Math.max(8,window.innerWidth-240));const top=Math.min(point.y,Math.max(8,window.innerHeight-130));if(!open||!data||!item)return null;const triggerAdd=()=>{setOpen(false);if(add?.quick){runQuickAction(add.quick,navigate);return;}const buttons=Array.from(document.querySelectorAll<HTMLElement>("main button")).filter(b=>{const text=(b.textContent||"").replace(/\s+/g," ").trim();return add?.patterns.some(r=>r.test(text));});if(buttons[0]){buttons[0].click();return;}if(pathname==="/app/messages")navigate({to:pathname});};return <div className="fixed inset-0 z-[10000] pointer-events-none"><div className="pointer-events-auto absolute min-w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-elevated" style={{left,top}} onClick={e=>e.stopPropagation()}><div className="px-2 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>{add&&<button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onClick={triggerAdd}><Plus className="h-4 w-4"/>{add.label}</button>}{!add&&<p className="px-2 py-1.5 text-xs text-muted-foreground">No quick action available here.</p>}</div></div>; }
