const path = require("path");
let Database = null;
try { Database = require("better-sqlite3"); } catch { Database = null; }
let db = null;

function open(userDataDir) {
  if (db) return db;
  if (!Database) return null;
  try {
    db = new Database(path.join(userDataDir, "medicore.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate();
    return db;
  } catch (e) {
    console.error("[db] open failed", e);
    db = null;
    return null;
  }
}

function close() {
  if (!db) return;
  try { db.close(); }
  finally { db = null; }
}

const available = () => db !== null;

function addColumnIfMissing(table, column, type) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existing.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), meta_json TEXT NOT NULL DEFAULT '{}', settings_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sync_meta (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO sync_meta (id, revision) VALUES (1, 0);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT);
    CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, company TEXT, balance REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, balance REAL NOT NULL DEFAULT 0, loyaltyPoints REAL NOT NULL DEFAULT 0, specialDiscountPercent REAL);
    CREATE TABLE IF NOT EXISTS medicines (id TEXT PRIMARY KEY, name TEXT NOT NULL, genericName TEXT, company TEXT, categoryId TEXT, batchNumber TEXT, barcode TEXT, purchasePrice REAL NOT NULL DEFAULT 0, salePrice REAL NOT NULL DEFAULT 0, mrp REAL NOT NULL DEFAULT 0, stockQuantity REAL NOT NULL DEFAULT 0, minimumStock REAL NOT NULL DEFAULT 0, expiryDate TEXT, manufactureDate TEXT, rackNumber TEXT, supplierId TEXT, description TEXT, pinOrder TEXT);
    CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
    CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(genericName);
    CREATE INDEX IF NOT EXISTS idx_medicines_company ON medicines(company);
    CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, supplierId TEXT, invoiceNumber TEXT, purchaseDate TEXT, receivedDate TEXT, taxPercent REAL NOT NULL DEFAULT 0, discount REAL NOT NULL DEFAULT 0, notes TEXT);
    CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchaseDate);
    CREATE TABLE IF NOT EXISTS purchase_items (rowid_ INTEGER PRIMARY KEY AUTOINCREMENT, purchaseId TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE, medicineId TEXT, quantity REAL NOT NULL DEFAULT 0, purchasePrice REAL NOT NULL DEFAULT 0, batchNumber TEXT, expiryDate TEXT);
    CREATE INDEX IF NOT EXISTS idx_pitems_purchase ON purchase_items(purchaseId);
    CREATE INDEX IF NOT EXISTS idx_pitems_medicine ON purchase_items(medicineId);
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, invoiceNumber TEXT, date TEXT, customerId TEXT, remark TEXT, discount REAL NOT NULL DEFAULT 0, taxPercent REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed', notes TEXT, createdBy TEXT, payments_json TEXT NOT NULL DEFAULT '[]', reprints_json TEXT NOT NULL DEFAULT '[]');
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE TABLE IF NOT EXISTS sale_items (rowid_ INTEGER PRIMARY KEY AUTOINCREMENT, saleId TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE, medicineId TEXT, quantity REAL NOT NULL DEFAULT 0, salePrice REAL NOT NULL DEFAULT 0, discountPercent REAL NOT NULL DEFAULT 0, costPriceAtSale REAL);
    CREATE INDEX IF NOT EXISTS idx_sitems_sale ON sale_items(saleId);
    CREATE INDEX IF NOT EXISTS idx_sitems_medicine ON sale_items(medicineId);
    CREATE TABLE IF NOT EXISTS stock_adjustments (id TEXT PRIMARY KEY, medicineId TEXT, date TEXT, delta REAL NOT NULL DEFAULT 0, reason TEXT);
    CREATE INDEX IF NOT EXISTS idx_stock_medicine ON stock_adjustments(medicineId);
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, entityType TEXT NOT NULL, entityId TEXT NOT NULL, action TEXT NOT NULL, username TEXT, userId TEXT, medicineName TEXT, quantity REAL, price REAL, timestamp TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entityType, entityId);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  `);
  addColumnIfMissing("medicines", "pinOrder", "TEXT");
  addColumnIfMissing("sale_items", "costPriceAtSale", "REAL");
  db.exec(`
    UPDATE sale_items
    SET costPriceAtSale = (
      SELECT pi.purchasePrice FROM purchases p JOIN purchase_items pi ON pi.purchaseId = p.id
      WHERE pi.medicineId = sale_items.medicineId AND p.purchaseDate IS NOT NULL
        AND p.purchaseDate <= (SELECT date FROM sales WHERE id = sale_items.saleId)
      ORDER BY p.purchaseDate DESC, p.id DESC, pi.rowid_ DESC LIMIT 1
    )
    WHERE costPriceAtSale IS NULL AND EXISTS (
      SELECT 1 FROM purchases p JOIN purchase_items pi ON pi.purchaseId = p.id
      WHERE pi.medicineId = sale_items.medicineId AND p.purchaseDate IS NOT NULL
        AND p.purchaseDate <= (SELECT date FROM sales WHERE id = sale_items.saleId)
    );
  `);
}

function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name).filter((n) => n !== "rowid_");
}
function upsert(table, row) {
  if (!available()) return null;
  const keys = cols(table).filter((k) => k in row);
  if (!keys.length) return null;
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((k) => `@${k}`).join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys.filter((k) => k !== "id").map((k) => `${k}=excluded.${k}`).join(",")}`;
  const payload = {}; for (const k of keys) payload[k] = row[k] === undefined ? null : row[k];
  db.prepare(sql).run(payload); return row.id ?? null;
}
const listAll = (table) => available() ? db.prepare(`SELECT * FROM ${table}`).all() : [];
const getOne = (table, id) => available() ? db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) ?? null : null;
const removeOne = (table, id) => { if (!available()) return false; db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); return true; };
const crud = (table) => ({ list: () => listAll(table), get: (id) => getOne(table, id), save: (row) => upsert(table, row), remove: (id) => removeOne(table, id) });
const medicines = { ...crud("medicines"), search: (query, limit = 100, offset = 0) => { if (!available()) return { rows: [], total: 0 }; const q = String(query ?? "").trim(); const lim = Math.max(1, Math.min(500, Number(limit) || 100)); const off = Math.max(0, Number(offset) || 0); if (!q) { const rows = db.prepare("SELECT * FROM medicines ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?").all(lim, off); return { rows, total: db.prepare("SELECT COUNT(*) AS count FROM medicines").get().count }; } const like = `%${q}%`; const rows = db.prepare("SELECT * FROM medicines WHERE name LIKE ? COLLATE NOCASE OR genericName LIKE ? COLLATE NOCASE OR company LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?").all(like, like, like, like, lim, off); const total = db.prepare("SELECT COUNT(*) AS count FROM medicines WHERE name LIKE ? COLLATE NOCASE OR genericName LIKE ? COLLATE NOCASE OR company LIKE ? COLLATE NOCASE OR barcode LIKE ? COLLATE NOCASE").get(like, like, like, like).count; return { rows, total }; } };
const customers = crud("customers"), suppliers = crud("suppliers"), categories = crud("categories"), stockAdjustments = crud("stock_adjustments");
const sales = { list: () => listAll("sales").map((s) => ({ id:s.id, invoiceNumber:s.invoiceNumber, date:s.date, customerId:s.customerId??undefined, remark:s.remark??undefined, discount:s.discount, taxPercent:s.taxPercent, status:s.status, notes:s.notes??undefined, createdBy:s.createdBy??undefined, payments:JSON.parse(s.payments_json||"[]"), reprints:JSON.parse(s.reprints_json||"[]"), items:db.prepare("SELECT medicineId, quantity, salePrice, discountPercent, costPriceAtSale FROM sale_items WHERE saleId = ?").all(s.id) })), save:(sale)=>{ if(!available()) return null; db.transaction(()=>{ upsert("sales",{...sale,payments_json:JSON.stringify(sale.payments??[]),reprints_json:JSON.stringify(sale.reprints??[])}); db.prepare("DELETE FROM sale_items WHERE saleId = ?").run(sale.id); const ins=db.prepare("INSERT INTO sale_items (saleId, medicineId, quantity, salePrice, discountPercent, costPriceAtSale) VALUES (?,?,?,?,?,?)"); for(const l of sale.items??[]){ let cost=l.costPriceAtSale==null?null:Number(l.costPriceAtSale); if(cost==null||!Number.isFinite(cost)){const m=db.prepare("SELECT purchasePrice FROM medicines WHERE id = ?").get(l.medicineId); cost=m?.purchasePrice==null?null:Number(m.purchasePrice);} ins.run(sale.id,l.medicineId,l.quantity,l.salePrice,l.discountPercent??0,Number.isFinite(cost)?cost:null); } })(); return sale.id; }, remove:(id)=>removeOne("sales",id) };
const purchases = { list:()=>listAll("purchases").map((p)=>({...p, supplierId:p.supplierId??undefined, receivedDate:p.receivedDate??undefined, notes:p.notes??undefined, items:db.prepare("SELECT medicineId, quantity, purchasePrice, batchNumber, expiryDate FROM purchase_items WHERE purchaseId = ?").all(p.id)})), save:(purchase)=>{if(!available())return null;db.transaction(()=>{upsert("purchases",purchase);db.prepare("DELETE FROM purchase_items WHERE purchaseId = ?").run(purchase.id);const ins=db.prepare("INSERT INTO purchase_items (purchaseId, medicineId, quantity, purchasePrice, batchNumber, expiryDate) VALUES (?,?,?,?,?,?)");for(const l of purchase.items??[])ins.run(purchase.id,l.medicineId,l.quantity,l.purchasePrice,l.batchNumber??null,l.expiryDate??null)})();return purchase.id;},remove:(id)=>removeOne("purchases",id)};
const settings = { get:()=>{if(!available())return null;const row=db.prepare("SELECT * FROM settings WHERE id = 1").get();if(!row)return null;return {meta:JSON.parse(row.meta_json||"{}"),settings:JSON.parse(row.settings_json||"{}")};}, save:(meta,s)=>{if(!available())return false;db.prepare(`INSERT INTO settings (id, meta_json, settings_json) VALUES (1, @m, @s) ON CONFLICT(id) DO UPDATE SET meta_json=@m, settings_json=@s`).run({m:JSON.stringify(meta??{}),s:JSON.stringify(s??{})});return true;} };
const auditLog = { add:(entry)=>{if(!available())return false;db.prepare(`INSERT INTO audit_log (id, entityType, entityId, action, username, userId, medicineName, quantity, price, timestamp) VALUES (@id,@entityType,@entityId,@action,@username,@userId,@medicineName,@quantity,@price,@timestamp)`).run({id:entry.id,entityType:entry.entityType,entityId:entry.entityId,action:entry.action,username:entry.username??null,userId:entry.userId??null,medicineName:entry.medicineName??null,quantity:entry.quantity??null,price:entry.price??null,timestamp:entry.timestamp});return true;},forEntity:(entityType,entityId)=>available()?db.prepare("SELECT * FROM audit_log WHERE entityType = ? AND entityId = ? ORDER BY timestamp DESC").all(entityType,entityId):[],since:(isoTimestamp)=>available()?db.prepare("SELECT * FROM audit_log WHERE timestamp > ? ORDER BY timestamp ASC, id ASC").all(isoTimestamp):[] };
function getRevision(){if(!available())return 0;return Number(db.prepare("SELECT revision FROM sync_meta WHERE id = 1").get()?.revision??0)}
function bumpRevision(){if(!available())return 0;db.prepare("UPDATE sync_meta SET revision = revision + 1 WHERE id = 1").run();return getRevision()}
function loadProject(){if(!available())return null;const head=settings.get();if(!head)return null;return {meta:head.meta,settings:head.settings,categories:categories.list(),suppliers:suppliers.list(),customers:customers.list(),medicines:medicines.list(),purchases:purchases.list(),sales:sales.list(),stockAdjustments:stockAdjustments.list()}}
function writeProjectRows(data){for(const t of ["sale_items","sales","purchase_items","purchases","medicines","customers","suppliers","categories","stock_adjustments"])db.prepare(`DELETE FROM ${t}`).run();settings.save(data.meta,data.settings);for(const r of data.categories??[])categories.save(r);for(const r of data.suppliers??[])suppliers.save(r);for(const r of data.customers??[])customers.save(r);for(const r of data.medicines??[])medicines.save(r);for(const r of data.purchases??[])purchases.save(r);for(const r of data.sales??[])sales.save(r);for(const r of data.stockAdjustments??[])stockAdjustments.save(r)}
function saveProject(data){if(!available()||!data)return false;db.transaction(()=>writeProjectRows(data))();return true}
function saveProjectIfRevision(data,expectedRevision){if(!available()||!data)return {ok:false,reason:"invalid"};const expected=Number(expectedRevision);return db.transaction(()=>{const current=getRevision();if(!Number.isInteger(expected)||expected!==current)return {ok:false,reason:"conflict",revision:current};writeProjectRows(data);db.prepare("UPDATE sync_meta SET revision = revision + 1 WHERE id = 1").run();return {ok:true,revision:current+1}})()}
function clearProject(){if(!available())return false;db.transaction(()=>{for(const t of ["sale_items","sales","purchase_items","purchases","medicines","customers","suppliers","categories","stock_adjustments","settings"])db.prepare(`DELETE FROM ${t}`).run();db.prepare("UPDATE sync_meta SET revision = revision + 1 WHERE id = 1").run()})();return true}

module.exports={open,close,available,medicines,sales,purchases,customers,suppliers,categories,stockAdjustments,settings,auditLog,loadProject,saveProject,saveProjectIfRevision,getRevision,bumpRevision,clearProject};
