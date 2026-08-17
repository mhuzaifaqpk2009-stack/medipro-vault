import type { ProjectData } from "@/domain/schema";

export function normalizePatientKey(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function patientSales(data: ProjectData, customerId: string) {
  return data.sales
    .filter((sale) => sale.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function patientPrescriptions(data: ProjectData, customer: { id: string; name: string; phone?: string }) {
  const name = normalizePatientKey(customer.name);
  const phone = normalizePatientKey(customer.phone);
  return (data.settings.prescriptions ?? [])
    .filter((p) => {
      const samePhone = phone && normalizePatientKey(p.patientPhone) === phone;
      const sameName = name && normalizePatientKey(p.patientName) === name;
      return Boolean(samePhone || sameName);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function patientMedicineHistory(data: ProjectData, customerId: string) {
  const totals = new Map<string, number>();
  for (const sale of patientSales(data, customerId)) {
    if (sale.status === "cancelled") continue;
    for (const item of sale.items) totals.set(item.medicineId, (totals.get(item.medicineId) ?? 0) + item.quantity);
  }
  return [...totals.entries()]
    .map(([medicineId, quantity]) => ({ medicineId, quantity, medicine: data.medicines.find((m) => m.id === medicineId) }))
    .filter((x) => x.medicine)
    .sort((a, b) => b.quantity - a.quantity);
}

export function patientSpent(data: ProjectData, customerId: string) {
  return patientSales(data, customerId).reduce((sum, sale) => {
    if (sale.status === "cancelled") return sum;
    return sum + sale.items.reduce((s, item) => s + item.salePrice * item.quantity * (1 - item.discountPercent / 100), 0);
  }, 0);
}
