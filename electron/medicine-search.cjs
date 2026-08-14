const { app, ipcMain } = require("electron");
const db = require("./db.cjs");

ipcMain.handle("db:medicines:search", (_event, query, limit, offset) => {
  db.open(app.getPath("userData"));
  if (!db.available()) return { rows: [], total: 0 };
  return db.medicines.search(query, limit, offset);
});
