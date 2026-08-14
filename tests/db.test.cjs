const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hpms-db-test-"));
  const dbPath = path.join(dir, "medicore.db");
  delete require.cache[require.resolve("../electron/db.cjs")];
  const db = require("../electron/db.cjs");
  assert.equal(db.open(dir) !== null, true);
  return { db, dir, dbPath };
}

test("SQLite enables foreign keys and cascades sale/purchase items", () => {
  const { db, dir } = freshDb();
  try {
    db.categories.save({ id: "cat-1", name: "Pain", description: "" });
    db.medicines.save({ id: "med-1", name: "Test Medicine", genericName: "Test", company: "ACME", purchasePrice: 10, salePrice: 15, mrp: 20, stockQuantity: 5, minimumStock: 1 });
    db.purchases.save({ id: "pur-1", supplierId: null, invoiceNumber: "INV-1", purchaseDate: "2026-01-01T00:00:00.000Z", items: [{ medicineId: "med-1", quantity: 5, purchasePrice: 10 }] });
    db.sales.save({ id: "sale-1", invoiceNumber: "S-1", date: "2026-02-01T00:00:00.000Z", items: [{ medicineId: "med-1", quantity: 1, salePrice: 15, discountPercent: 0, costPriceAtSale: 10 }] });
    const raw = require("better-sqlite3")(dbPath);
    assert.equal(raw.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sale_items").get().n, 1);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM purchase_items").get().n, 1);
    raw.prepare("DELETE FROM sales WHERE id = ?").run("sale-1");
    raw.prepare("DELETE FROM purchases WHERE id = ?").run("pur-1");
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sale_items").get().n, 0);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM purchase_items").get().n, 0);
    raw.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("historical sale cost is backfilled from the latest purchase before the sale", () => {
  const { db, dir } = freshDb();
  try {
    db.medicines.save({ id: "med-2", name: "Historical", purchasePrice: 99, salePrice: 120, mrp: 130, stockQuantity: 1, minimumStock: 0 });
    db.purchases.save({ id: "pur-old", invoiceNumber: "OLD", purchaseDate: "2026-01-01T00:00:00.000Z", items: [{ medicineId: "med-2", quantity: 10, purchasePrice: 20 }] });
    db.purchases.save({ id: "pur-new", invoiceNumber: "NEW", purchaseDate: "2026-03-01T00:00:00.000Z", items: [{ medicineId: "med-2", quantity: 10, purchasePrice: 50 }] });
    db.sales.save({ id: "sale-old", invoiceNumber: "SO", date: "2026-02-01T00:00:00.000Z", items: [{ medicineId: "med-2", quantity: 1, salePrice: 100, discountPercent: 0 }] });
    const sale = db.sales.get ? db.sales.get("sale-old") : db.sales.list().find((x) => x.id === "sale-old");
    assert.equal(sale.items[0].costPriceAtSale, 20);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("server project revision rejects stale writes atomically", () => {
  const { db, dir } = freshDb();
  try {
    const base = { meta: { id: "p", name: "Test" }, settings: {}, medicines: [], customers: [], suppliers: [], categories: [], purchases: [], sales: [], stockAdjustments: [] };
    assert.equal(db.saveProject(base), true);
    const firstRevision = db.getRevision();
    const newer = { ...base, meta: { ...base.meta, name: "Newer" } };
    const first = db.saveProjectIfRevision(newer, firstRevision);
    assert.equal(first.ok, true);
    assert.equal(first.revision, firstRevision + 1);
    const stale = { ...base, meta: { ...base.meta, name: "STALE" } };
    const rejected = db.saveProjectIfRevision(stale, firstRevision);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, "conflict");
    assert.equal(db.loadProject().meta.name, "Newer");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("medicine search is SQL-side and paginated", () => {
  const { db, dir } = freshDb();
  try {
    for (let i = 0; i < 250; i++) db.medicines.save({ id: `m-${i}`, name: `Medicine ${i}`, genericName: i % 2 ? "GenericA" : "GenericB", company: "ACME", barcode: `BC-${i}`, purchasePrice: 1, salePrice: 2, mrp: 3, stockQuantity: 1, minimumStock: 0 });
    const page = db.medicines.search("GenericA", 25, 10);
    assert.equal(page.rows.length, 25);
    assert.equal(page.total, 125);
    assert.match(page.rows[0].genericName, /GenericA/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
