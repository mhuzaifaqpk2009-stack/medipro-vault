import type { Sale, ProjectData } from "@/domain/schema";

const FIXED_HEADER = "Jalal & Brothers Pharmacy";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

export function buildReceiptHtml(sale: Sale, data: ProjectData): string {
  const s = data.settings;
  const sym = s.currencySymbol || "$";
  const lookup = (id: string) => data.medicines.find((m) => m.id === id);
  const customer = sale.customerId
    ? data.customers.find((c) => c.id === sale.customerId)
    : null;
  const customerName = customer?.name || "Walk-in";
  const subtotal = sale.items.reduce(
    (a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0,
  );
  const tax = subtotal * (sale.taxPercent / 100);
  const total = Math.max(0, subtotal + tax - sale.discount);
  const rows = sale.items.map((l, i) => {
    const m = lookup(l.medicineId);
    const line = l.salePrice * l.quantity * (1 - l.discountPercent / 100);
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(m?.name ?? l.medicineId)}</td>
      <td class="r">${l.quantity}</td>
      <td class="r">${sym}${l.salePrice.toFixed(2)}</td>
      <td class="r">${sym}${line.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const footer1 = (s as any).billFooter1 || "Thanks for purchasing";
  const footer2 = (s as any).billFooter2 || "Please check & verify your medicines. Medicines will be returned within 15 days. Fridge items are not returnable.";

  const remarkLine = `<div class="meta-line"><strong>Remarks:</strong> ${esc(sale.remark ?? "")}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoiceNumber)}</title>
<style>
  /* Thermal 80mm — printer driver ignores @page margin, so real whitespace comes from body padding. */
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Courier New', ui-monospace, monospace;
    font-size: 12px; color: #000;
    width: 80mm;
    padding: 5mm 4mm 8mm 4mm;   /* top right bottom left — visible margin on thermal */
  }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; letter-spacing: .5px; }
  .addr, .footer { text-align: center; font-size: 11px; line-height: 1.35; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .divider-solid { border-top: 1px solid #000; margin: 6px 0; }
  .meta-row { display: flex; justify-content: space-between; font-size: 11px; }
  .meta-line { font-size: 11px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 2px 3px; text-align: left; word-break: break-word; }
  th { border-bottom: 1px solid #000; }
  tbody tr:last-child td { border-bottom: 1px solid #000; }
  .r { text-align: right; }
  .totals { margin-top: 6px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
  .footer { margin-top: 10px; font-size: 10.5px; white-space: pre-wrap; }
  @media screen { body { box-shadow: 0 0 0 1px #ddd; margin: 12px auto; } }
</style></head><body>
  <h1>${esc(FIXED_HEADER)}</h1>
  <div class="addr">${esc(s.address || "")}</div>
  <div class="addr">${esc(s.phone ? "Ph: " + s.phone : "")}</div>
  <div class="divider"></div>
  <div class="meta-row"><span>Invoice #: ${esc(sale.invoiceNumber)}</span><span>${new Date(sale.date).toLocaleString()}</span></div>
  <div class="meta-line"><strong>Customer:</strong> ${esc(customerName)}</div>
  ${remarkLine}
  <div class="divider-solid"></div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${sym}${subtotal.toFixed(2)}</span></div>
    <div class="row"><span>Tax (${sale.taxPercent}%)</span><span>${sym}${tax.toFixed(2)}</span></div>
    <div class="row"><span>Discount</span><span>-${sym}${sale.discount.toFixed(2)}</span></div>
    <div class="row grand"><span>TOTAL</span><span>${sym}${total.toFixed(2)}</span></div>
  </div>
  <div class="divider"></div>
  <div class="footer">${esc(footer1)}</div>
  <div class="footer" style="margin-top:6px">${esc(footer2)}</div>
</body></html>`;
}

export async function printReceipt(sale: Sale, data: ProjectData) {
  const html = buildReceiptHtml(sale, data);
  const api = (typeof window !== "undefined" ? (window as any).medicore : null);
  if (api?.print?.html) {
    try {
      const res = await api.print.html(html);
      if (!res?.ok) console.error("[printReceipt] electron print failed:", res?.error);
      return;
    } catch (err) {
      console.error("[printReceipt] IPC error:", err);
      return;
    }
  }
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { console.error("[printReceipt] window.open blocked"); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.error(e); } }, 250);
}

export function nextInvoiceNumber(sales: { invoiceNumber: string }[]): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const prefix = `INV-${ymd}-`;
  const nums = sales
    .map((s) => s.invoiceNumber)
    .filter((n) => n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
