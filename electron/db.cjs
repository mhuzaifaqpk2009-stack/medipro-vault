/**
 * MediCore — local SQLite data layer (offline desktop only).
 *
 * Tables mirror src/domain/schema.ts exactly:
 *   settings (single row, JSON blob of PharmacySettings + meta)
 *   categories, suppliers, customers, medicines,
 *   purchases + purchase_items, sales + sale_items, stock_adjustments
 *
 * better-sqlite3 is an OPTIONAL dependency: if the native module is missing
 * (e.g. plain `npm i` on a machine without build tools) every export below
 * degrades to a no-op / null and the app silently falls back to the existing
 * encrypted-file storage. Nothing here ever runs in the browser preview.
 */
const path = require("path");

let Database = null;
try {
  Database = require("better-sqlite3");
} catch {
  Database = null;
}

let db = null;

/** Opens (and on first run creates) userData/medicore.db. Returns null if unavailable. */
function open(userDataDir) {
  if (db) return db;
  if (!Database) return null;
  try {
    db = new Database(path.join(userDataDir, "medicore.db"));
    db.pragma("journal_mode = WAL");
    migrate();
    return db;
  } catch (e) {
    console.error("[db] open failed", e);
    db = null;
    return null;
  }
}

const available = () => db !== null;

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      meta_json TEXT NOT NULL DEFAULT '{}',
      settings_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
      address TEXT, company TEXT, balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
      address TEXT, balance REAL NOT NULL DEFAULT 0,
      loyaltyPoints REAL NOT NULL DEFAULT 0,
      specialDiscountPercent REAL
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genericName TEXT, company TEXT,
      categoryId TEXT, batchNumber TEXT, barcode TEXT,
      purchasePrice REAL NOT NULL DEFAULT 0, salePrice REAL NOT NULL DEFAULT 0,
      mrp REAL NOT NULL DEFAULT 0, stockQuantity REAL NOT NULL DEFAULT 0,
      minimumStock REAL NOT NULL DEFAULT 0, expiryDate TEXT, manufactureDate TEXT,
      rackNumber TEXT, supplierId TEXT, description TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY, supplierId TEXT, invoiceNumber TEXT,
      purchaseDate TEXT, receivedDate TEXT,
      taxPercent REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      rowid_ INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseId TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      medicineId TEXT, quantity REAL NOT NULL DEFAULT 0,
      purchasePrice REAL NOT NULL DEFAULT 0, batchNumber TEXT, expiryDate TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pitems_purchase ON purchase_items(purchaseId);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY, invoiceNumber TEXT, date TEXT, customerId TEXT,
      remark TEXT, discount REAL NOT NULL DEFAULT 0, taxPercent REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed', notes TEXT, createdBy TEXT,
      payments_json TEXT NOT NULL DEFAULT '[]', reprints_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE TABLE IF NOT EXISTS sale_items (
      rowid_ INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      medicineId TEXT, quantity REAL NOT NULL DEFAULT 0,
      salePrice REAL NOT NULL DEFAULT 0, discountPercent REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sitems_sale ON sale_items(saleId);

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY, medicineId TEXT, date TEXT,
      delta REAL NOT NULL DEFAULT 0, reason TEXT
    );
  `);
}

/* ------------------------------------------------------------------ *
 * Generic CRUD helpers                                                *
 * ------------------------------------------------------------------ */
function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all()
    .map((c) => c.name)
    .filter((n) => n !== "rowid_");
}

function upsert(table, row) {
  if (!available()) return null;
  const keys = cols(table).filter((k) => k in row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((k) => `@${k}`).join(",")})
    ON CONFLICT(id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k}=excluded.${k}`).join(",")}`;
  const payload = {};
  for (const k of keys) payload[k] = row[k] === undefined ? null : row[k];
  db.prepare(sql).run(payload);
  return row.id ?? null;
}

const listAll = (table) => (available() ? db.prepare(`SELECT * FROM ${table}`).all() : []);
const getOne = (table, id) =>
  available() ? db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) ?? null : null;
const removeOne = (table, id) => {
  if (!available()) return false;
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return true;
};

/* --- per-entity CRUD (thin wrappers, exposed 1:1 to the renderer) --- */
const crud = (table) => ({
  list: () => listAll(table),
  get: (id) => getOne(table, id),
  save: (row) => upsert(table, row),
  remove: (id) => removeOne(table, id),
});

const medicines = crud("medicines");
const customers = crud("customers");
const suppliers = crud("suppliers");
const categories = crud("categories");
const stockAdjustments = crud("stock_adjustments");

const sales = {
  list: () =>
    listAll("sales").map((s) => ({
      id: s.id, invoiceNumber: s.invoiceNumber, date: s.date,
      customerId: s.customerId ?? undefined, remark: s.remark ?? undefined,
      discount: s.discount, taxPercent: s.taxPercent, status: s.status,
      notes: s.notes ?? undefined, createdBy: s.createdBy ?? undefined,
      payments: JSON.parse(s.payments_json || "[]"),
      reprints: JSON.parse(s.reprints_json || "[]"),
      items: db.prepare("SELECT medicineId, quantity, salePrice, discountPercent FROM sale_items WHERE saleId = ?").all(s.id),
    })),
  save: (sale) => {
    if (!available()) return null;
    const tx = db.transaction(() => {
      upsert("sales", {
        ...sale,
        payments_json: JSON.stringify(sale.payments ?? []),
        reprints_json: JSON.stringify(sale.reprints ?? []),
      });
      db.prepare("DELETE FROM sale_items WHERE saleId = ?").run(sale.id);
      const ins = db.prepare(
        "INSERT INTO sale_items (saleId, medicineId, quantity, salePrice, discountPercent) VALUES (?,?,?,?,?)",
      );
      for (const l of sale.items ?? []) ins.run(sale.id, l.medicineId, l.quantity, l.salePrice, l.discountPercent ?? 0);
    });
    tx();
    return sale.id;
  },
  remove: (id) => removeOne("sales", id),
};

const purchases = {
  list: () =>
    listAll("purchases").map((p) => ({
      id: p.id, supplierId: p.supplierId ?? undefined, invoiceNumber: p.invoiceNumber,
      purchaseDate: p.purchaseDate, receivedDate: p.receivedDate ?? undefined,
      taxPercent: p.taxPercent, discount: p.discount, notes: p.notes ?? undefined,
      items: db.prepare("SELECT medicineId, quantity, purchasePrice, batchNumber, expiryDate FROM purchase_items WHERE purchaseId = ?").all(p.id),
    })),
  save: (purchase) => {
    if (!available()) return null;
    const tx = db.transaction(() => {
      upsert("purchases", purchase);
      db.prepare("DELETE FROM purchase_items WHERE purchaseId = ?").run(purchase.id);
      const ins = db.prepare(
        "INSERT INTO purchase_items (purchaseId, medicineId, quantity, purchasePrice, batchNumber, expiryDate) VALUES (?,?,?,?,?,?)",
      );
      for (const l of purchase.items ?? [])
        ins.run(purchase.id, l.medicineId, l.quantity, l.purchasePrice, l.batchNumber ?? null, l.expiryDate ?? null);
    });
    tx();
    return purchase.id;
  },
  remove: (id) => removeOne("purchases", id),
};

const settings = {
  get: () => {
    if (!available()) return null;
    const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    if (!row) return null;
    return { meta: JSON.parse(row.meta_json || "{}"), settings: JSON.parse(row.settings_json || "{}") };
  },
  save: (meta, s) => {
    if (!available()) return false;
    db.prepare(`INSERT INTO settings (id, meta_json, settings_json) VALUES (1, @m, @s)
      ON CONFLICT(id) DO UPDATE SET meta_json = @m, settings_json = @s`)
      .run({ m: JSON.stringify(meta ?? {}), s: JSON.stringify(s ?? {}) });
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Whole-project snapshot (what the Zustand store uses)                *
 * ------------------------------------------------------------------ */
function loadProject() {
  if (!available()) return null;
  const head = settings.get();
  if (!head) return null;
  return {
    meta: head.meta,
    settings: head.settings,
    categories: categories.list(),
    suppliers: suppliers.list(),
    customers: customers.list(),
    medicines: medicines.list(),
    purchases: purchases.list(),
    sales: sales.list(),
    stockAdjustments: stockAdjustments.list(),
  };
}

/** Replaces the whole database contents with `data` (a ProjectData object). */
function saveProject(data) {
  if (!available() || !data) return false;
  const tx = db.transaction(() => {
    for (const t of ["sale_items", "sales", "purchase_items", "purchases",
      "medicines", "customers", "suppliers", "categories", "stock_adjustments"]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    settings.save(data.meta, data.settings);
    for (const r of data.categories ?? []) categories.save(r);
    for (const r of data.suppliers ?? []) suppliers.save(r);
    for (const r of data.customers ?? []) customers.save(r);
    for (const r of data.medicines ?? []) medicines.save(r);
    for (const r of data.purchases ?? []) purchases.save(r);
    for (const r of data.sales ?? []) sales.save(r);
    for (const r of data.stockAdjustments ?? []) stockAdjustments.save(r);
  });
  tx();
  return true;
}

function clearProject() {
  if (!available()) return false;
  const tx = db.transaction(() => {
    for (const t of ["sale_items", "sales", "purchase_items", "purchases", "medicines",
      "customers", "suppliers", "categories", "stock_adjustments", "settings"]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
  });
  tx();
  return true;
}

module.exports = {
  open, available,
  medicines, sales, purchases, customers, suppliers, categories, stockAdjustments, settings,
  loadProject, saveProject, clearProject,
};
