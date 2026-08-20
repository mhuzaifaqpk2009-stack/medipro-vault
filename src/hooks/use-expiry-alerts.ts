import { useEffect } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";
import { getExpiryAlerts } from "@/lib/expiry-alerts";
export function useExpiryAlerts(){ const data=useProjectStore(s=>s.data); useEffect(()=>{ if(!data) return; const alerts=getExpiryAlerts(data,30); const urgent=alerts.filter(a=>a.days<=7); if(!urgent.length) return; const key=`medipro:expiry-alert:${new Date().toISOString().slice(0,10)}`; if(localStorage.getItem(key)) return; localStorage.setItem(key,"1"); toast.error(`${urgent.length} medicine batch${urgent.length===1?"":"es"} ${urgent.some(a=>a.days<0)?"expired or": "are"} within 7 days`); },[data]); }
