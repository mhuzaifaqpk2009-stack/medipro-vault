import type { Sale, ProjectData } from "@/domain/schema";

const FIXED_HEADER = "Jalal & Brothers Pharmacy";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function wrapMedicineName(name: string): string {
  return esc(name);
}

// Plain number, no currency symbol — used for individual item prices/lines.
function num(n: number): string {
  return n.toFixed(2);
}

// Comma-formatted number with currency symbol — used only for the totals block.
function money(n: number, sym: string): string {
  const withCommas = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${withCommas}`;
}

export function buildReceiptHtml(sale: Sale, data: ProjectData): string {
  const s = data.settings;
  const sym = s.currencySymbol || "$";
  const lookup = (id: string) => data.medicines.find((m) => m.id === id);
  const customer = sale.customerId
    ? data.customers.find((c) => c.id === sale.customerId)
    : null;
  const customerName = customer?.name || "Walk-in customer";

  const subtotal = sale.items.reduce(
    (a, l) => a + l.salePrice * l.quantity * (1 - l.discountPercent / 100), 0,
  );
  const tax = subtotal * (sale.taxPercent / 100);
  const grossTotal = subtotal + tax;
  const discountValue = grossTotal * (sale.discount / 100);
  const total = Math.max(0, grossTotal - discountValue);

  const rows = sale.items.map((l) => {
    const m = lookup(l.medicineId);
    const line = l.salePrice * l.quantity * (1 - l.discountPercent / 100);
    return `<tr>
      <td>${wrapMedicineName(m?.name ?? l.medicineId)}</td>
      <td class="r">${l.quantity}</td>
      <td class="r">${num(l.salePrice)}</td>
      <td class="r">${num(line)}</td>
    </tr>`;
  }).join("");

  const cashierName = sale.createdBy || (sale as any).cashierName || "";

  const footer1 = (s as any).billFooter1 || "Thanks for purchasing";
  const footer2 = (s as any).billFooter2 || "Please check & verify your medicines. Medicines will be returned within 15 days. Fridge items are not returnable.";

  const d = new Date(sale.date);
  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoiceNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; }
  html { display: flex; justify-content: center; }
  html, body { margin: 0; padding: 0; background: #fff; overflow-x: hidden; max-width: 100%; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    font-weight: normal;
    color: #000;
    width: 80mm;
    flex-shrink: 0;
    padding: 6mm 7mm 10mm 7mm;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 18px; text-align: center; margin: 0 0 2px; font-weight: bold; color: #000; }
  .addr, .footer { text-align: center; font-size: 12px; line-height: 1.35; color: #000; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .divider-solid { border-top: 1px solid #000; margin: 2px 0; }
  .meta-row { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; white-space: nowrap; color: #000; }
  .meta-row > span { min-width: 0; }
  .meta-line { font-size: 12px; margin-top: 2px; color: #000; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; color: #000; }
  th, td { padding: 3px 3px; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
  td:first-child, th:first-child { white-space: normal; word-break: break-word; }
  th { border-bottom: 1px solid #000; font-weight: normal; color: #000; font-size: 11px; }
  tbody tr:last-child td { border-bottom: 1px solid #000; }
  tbody td { color: #000; }
  col.item  { width: 32%; }
  col.qty   { width: 24%; }
  col.price { width: 21%; }
  col.total { width: 23%; }
  .r { text-align: right; }
  .totals { width: 100%; margin-top: 6px; font-size: 12px; }
  .totals-block { width: 100%; padding-left: 15mm; }
  .totals-block .row {
    position: relative;
    display: grid;
    grid-template-columns: 12ch 1fr;
    align-items: center;
    margin: 2px 0;
    gap: 6px;
  }
  .totals .gross, .totals .disc, .totals .netlabel { text-align: right; }
  .totals .value { text-align: right; font-weight: normal; font-size: 12px; }
  .totals .value.net { font-weight: bold; font-size: 12.5px; }
  .served-by-inline {
    position: absolute;
    left: -15mm;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10.5px;
    color: #000;
    white-space: nowrap;
  }

  .footer { font-size: 11.5px; white-space: pre-wrap; color: #000; }
  .footer:first-of-type { margin-top: 10px; }
  .footer + .footer { margin-top: 0; }
  @media screen { body { box-shadow: 0 0 0 1px #ddd; margin: 12px auto; } }
</style></head><body>
  <h1>${esc(FIXED_HEADER)}</h1>
  <div class="addr">${esc(s.address || "")}</div>
  <div class="addr">${esc(s.phone ? "Phone -" + s.phone : "")}</div>
  <div class="divider"></div>
  <div class="meta-row"><span>No. ${esc(sale.invoiceNumber)}</span><span>${esc(dateStr)}, ${esc(timeStr)}</span></div>
  <div class="meta-line">M/s: ${esc(customerName)}</div>
  <div class="meta-line">Remarks: ${esc(sale.remark ?? "")}</div>
  <div class="divider-solid"></div>
  <table>
    <colgroup><col class="item" /><col class="qty" /><col class="price" /><col class="total" /></colgroup>
    <thead><tr><th>Item Name</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="meta-line">Total items: ${sale.items.length}</div>
  <div class="divider-solid"></div>
  <div class="totals">
    <div class="totals-block">
      <div class="row"><span class="gross">Gross Total:</span><span class="value">${num(grossTotal)}</span></div>
      <div class="row"><span class="disc">Disc:</span><span class="value">${num(discountValue)}</span></div>
      <div class="row net-row">
        <span class="served-by-inline">${cashierName ? esc(cashierName) : ""}</span>
        <span class="netlabel">Net Total:</span>
        <span class="value net">${money(total, sym)}</span>
      </div>
    </div>
  </div>
  <div class="divider-solid"></div>
  <div class="footer">${esc(footer1)}</div>
  <div class="footer">${esc(footer2)}</div>
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
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (e) { console.error(e); }
  }, 250);
}

/** Sequential numeric invoice numbers starting at 1000. Resets when sales list is empty. */
export function nextInvoiceNumber(sales: { invoiceNumber: string }[]): string {
  const nums = sales
    .map((s) => parseInt(String(s.invoiceNumber).replace(/[^0-9]/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n >= 1000);
  const next = nums.length ? Math.max(...nums) + 1 : 1000;
  return String(next);
}

/** Generic document printing (used by report printouts). */
export async function printHtml(html: string) {
  const api = (typeof window !== "undefined" ? (window as any).medicore : null);
  if (api?.print?.html) {
    try {
      const res = await api.print.html(html);
      if (!res?.ok) console.error("[printHtml] electron print failed:", res?.error);
      return;
    } catch (err) {
      console.error("[printHtml] IPC error:", err);
      return;
    }
  }
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { console.error("[printHtml] window.open blocked"); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (e) { console.error(e); }
  }, 250);
}
