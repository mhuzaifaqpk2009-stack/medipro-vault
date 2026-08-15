import type { Medicine, ProjectData } from "@/domain/schema";
import type { StoredUser } from "@/lib/users";

export type PrescriptionVisibility = "admin" | "all" | "selected";
export type PrescriptionRepeatUnit = "day" | "week" | "month" | "year";

export interface PrescriptionLine {
  medicineId: string;
  quantity: number;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  date: string;
  patientName: string;
  patientPhone?: string;
  doctorName?: string;
  diagnosis?: string;
  notes?: string;
  items: PrescriptionLine[];
  createdBy?: string;
  visibility: PrescriptionVisibility;
  allowedUserIds?: string[];
  nextVisitDate?: string;
  repeatEvery?: number;
  repeatUnit?: PrescriptionRepeatUnit;
  notifyBeforeDays?: number;
}

export function todayDate() { return new Date().toISOString().slice(0, 10); }

export function addRepeat(date: string, every = 1, unit: PrescriptionRepeatUnit = "month") {
  const d = new Date(`${date}T12:00:00`);
  const n = Math.max(1, Math.floor(every || 1));
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "week") d.setDate(d.getDate() + n * 7);
  else if (unit === "year") d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function isPrescriptionVisible(p: Prescription, user: StoredUser | null) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (p.visibility === "admin") return false;
  if (p.visibility === "all") return true;
  return (p.allowedUserIds ?? []).includes(user.id);
}

export function isPrescriptionDueSoon(p: Prescription, today = todayDate()) {
  if (!p.nextVisitDate) return false;
  const days = Math.max(0, p.notifyBeforeDays ?? 1);
  const due = new Date(`${p.nextVisitDate}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return due >= now && due - now <= days * 86400000;
}

export function isPrescriptionDue(p: Prescription, today = todayDate()) {
  return !!p.nextVisitDate && p.nextVisitDate <= today;
}

export function advancePrescriptionVisit(p: Prescription, fromDate = p.nextVisitDate) {
  if (!p.repeatEvery || !p.repeatUnit || !fromDate) return undefined;
  return addRepeat(fromDate, p.repeatEvery, p.repeatUnit);
}

export function medicineForPrescription(data: ProjectData, line: PrescriptionLine): Medicine | undefined {
  return data.medicines.find((m) => m.id === line.medicineId);
}
