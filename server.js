// server.js — Express API + static file serving for Farmacy App.
// Run: npm install && node server.js   (default port 3000)

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, getSetting, setSetting, getAllSettings } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// Sessions: in-memory token map. token -> { userId, username, fullName, role, portal }
// portal is 'pharmacy' or 'builder'. Server restarts invalidate sessions.
// ---------------------------------------------------------------------------
const sessions = new Map();

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function err(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const s = token && sessions.get(token);
  if (!s) return err(res, 401, 'অননুমোদিত। আবার লগইন করুন।');
  req.user = s;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return err(res, 403, 'এই কাজের অনুমতি আপনার নেই।');
    }
    next();
  };
}

// Software ON/OFF gate: when software_online = '0', every pharmacy-portal
// request is blocked with 503 + maintenance message. Builder portal bypasses.
function onlineGate(req, res, next) {
  if (getSetting('software_online') === '0' && req.user.portal !== 'builder') {
    return err(res, 503, getSetting('maintenance_message'), { maintenance: true });
  }
  next();
}

const pharmacyApi = [auth, onlineGate]; // applied to all pharmacy API routes

function asInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function cleanStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// Auth & portals
// ---------------------------------------------------------------------------

// First-run Master Admin setup. Works only when no master_admin exists yet.
app.post('/api/setup-master', (req, res) => {
  const { pharmacyName, fullName, username, password } = req.body || {};
  if (!cleanStr(pharmacyName) || !cleanStr(fullName) || !cleanStr(username) || !password) {
    return err(res, 400, 'সব ঘর পূরণ করুন।');
  }
  if (String(password).length < 4) {
    return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  }
  const exists = db.prepare("SELECT id FROM users WHERE role = 'master_admin' LIMIT 1").get();
  if (exists) return err(res, 400, 'মাস্টার অ্যাডমিন ইতিমধ্যে তৈরি আছে। সরাসরি লগইন করুন।');
  const uname = cleanStr(username, 100).toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return err(res, 400, 'এই ইউজারনেম ইতিমধ্যে ব্যবহার হয়েছে।');
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(uname, hash, cleanStr(fullName, 100), 'master_admin');
  setSetting('pharmacy_name', cleanStr(pharmacyName, 150));
  const token = newToken();
  sessions.set(token, {
    userId: info.lastInsertRowid, username: uname,
    fullName: cleanStr(fullName, 100), role: 'master_admin', portal: 'pharmacy',
    createdAt: Date.now(),
  });
  res.json({ ok: true, token, user: { username: uname, fullName: cleanStr(fullName, 100), role: 'master_admin' } });
});

// One-time builder (Super Admin) setup. Works only when no super_admin exists.
app.post('/api/setup-builder', (req, res) => {
  const { fullName, builderId, password } = req.body || {};
  if (!cleanStr(fullName) || !cleanStr(builderId) || !password) {
    return err(res, 400, 'সব ঘর পূরণ করুন।');
  }
  if (String(password).length < 4) {
    return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  }
  const exists = db.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").get();
  if (exists) return err(res, 400, 'বিল্ডার অ্যাকাউন্ট ইতিমধ্যে তৈরি আছে। সরাসরি লগইন করুন।');
  const uname = cleanStr(builderId, 100).toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return err(res, 400, 'এই বিল্ডার আইডি ইতিমধ্যে ব্যবহার হয়েছে।');
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(uname, hash, cleanStr(fullName, 100), 'super_admin');
  const token = newToken();
  sessions.set(token, {
    userId: info.lastInsertRowid, username: uname,
    fullName: cleanStr(fullName, 100), role: 'super_admin', portal: 'builder',
    createdAt: Date.now(),
  });
  res.json({ ok: true, token, user: { username: uname, fullName: cleanStr(fullName, 100), role: 'super_admin' } });
});

// Login with portal isolation: super_admin only via 'builder', everyone else only via 'pharmacy'.
app.post('/api/login', (req, res) => {
  const { username, password, portal } = req.body || {};
  if (!username || !password) return err(res, 400, 'ইউজারনেম ও পাসওয়ার্ড দিন।');
  const p = portal === 'builder' ? 'builder' : 'pharmacy';
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanStr(username, 100).toLowerCase());
  if (!u || !u.active) return err(res, 401, 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
  if (!bcrypt.compareSync(String(password), u.password_hash)) {
    return err(res, 401, 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
  }
  if (p === 'builder' && u.role !== 'super_admin') {
    return err(res, 403, 'এই পোর্টাল শুধু সফটওয়্যার নির্মাতার জন্য।');
  }
  if (p === 'pharmacy' && u.role === 'super_admin') {
    return err(res, 403, 'সুপার অ্যাডমিন ফার্মেসি পোর্টালে লগইন করতে পারবে না। নির্মাতার পোর্টাল ব্যবহার করুন।');
  }
  if (p === 'pharmacy' && getSetting('software_online') === '0') {
    return err(res, 503, getSetting('maintenance_message'), { maintenance: true });
  }
  const token = newToken();
  sessions.set(token, {
    userId: u.id, username: u.username, fullName: u.full_name,
    role: u.role, portal: p, createdAt: Date.now(),
  });
  res.json({ ok: true, token, user: { username: u.username, fullName: u.full_name, role: u.role } });
});

app.post('/api/logout', auth, (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get('/api/auth-status', (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const s = token && sessions.get(token);
  const needsSetup = !db.prepare("SELECT id FROM users WHERE role = 'master_admin' LIMIT 1").get();
  const needsBuilderSetup = !db.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").get();
  res.json({
    ok: true,
    user: s ? { username: s.username, fullName: s.fullName, role: s.role, portal: s.portal } : null,
    needsSetup,
    needsBuilderSetup,
    softwareOnline: getSetting('software_online') === '1',
    maintenanceMessage: getSetting('maintenance_message'),
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
app.get('/api/dashboard', ...pharmacyApi, (req, res) => {
  const today = todayStr();
  const counts = db.prepare(
    'SELECT COUNT(*) AS medicineCount, COALESCE(SUM(stock),0) AS totalUnits, COALESCE(SUM(stock * sale_price),0) AS stockValue FROM medicines'
  ).get();
  const lowStock = db.prepare(
    'SELECT id, name, stock, reorder_level, unit FROM medicines WHERE stock <= reorder_level ORDER BY stock ASC LIMIT 20'
  ).all();
  const expiring = db.prepare(
    `SELECT id, name, expiry_date, stock, unit FROM medicines
     WHERE expiry_date IS NOT NULL AND expiry_date != ''
       AND date(expiry_date) >= date('now') AND date(expiry_date) <= date('now', '+60 days')
     ORDER BY expiry_date ASC LIMIT 20`
  ).all();
  const expiredCount = db.prepare(
    `SELECT COUNT(*) AS c FROM medicines
     WHERE expiry_date IS NOT NULL AND expiry_date != '' AND date(expiry_date) < date('now')`
  ).get().c;
  const todaySales = db.prepare('SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS c FROM sales WHERE date = ?').get(today);
  const totalDue = db.prepare(
    'SELECT (SELECT COALESCE(SUM(due),0) FROM sales) + (SELECT COALESCE(SUM(due),0) FROM purchases) AS d'
  ).get().d;
  const grossProfit = db.prepare(
    `SELECT COALESCE(SUM(si.qty * (si.price - m.purchase_price)), 0) AS p
     FROM sale_items si JOIN medicines m ON m.id = si.medicine_id`
  ).get().p;
  const recentSales = db.prepare(
    'SELECT id, invoice_no, customer_name, total, paid, due, date FROM sales ORDER BY id DESC LIMIT 8'
  ).all();
  const recentPurchases = db.prepare(
    `SELECT p.id, p.invoice_no, p.total, p.paid, p.due, p.date, COALESCE(s.name, '-') AS supplier_name
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.id DESC LIMIT 8`
  ).all();
  res.json({
    ok: true,
    stats: {
      medicineCount: counts.medicineCount, totalUnits: counts.totalUnits, stockValue: counts.stockValue,
      lowStockCount: lowStock.length, expiringCount: expiring.length, expiredCount,
      todaySales: todaySales.t, todayTransactions: todaySales.c, totalDue, grossProfit,
    },
    alerts: { lowStock, expiring },
    recentSales, recentPurchases,
    settings: getAllSettings(),
  });
});

// ---------------------------------------------------------------------------
// Medicines
// ---------------------------------------------------------------------------
app.get('/api/medicines', ...pharmacyApi, (req, res) => {
  const { q, lowstock, expiring } = req.query;
  let sql = `SELECT m.*, COALESCE(s.name, '') AS supplier_name FROM medicines m
             LEFT JOIN suppliers s ON s.id = m.supplier_id WHERE 1=1`;
  const params = [];
  if (q) { sql += ' AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.sku LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (lowstock === '1') sql += ' AND m.stock <= m.reorder_level';
  if (expiring === '1') {
    sql += ` AND m.expiry_date IS NOT NULL AND m.expiry_date != ''
             AND date(m.expiry_date) >= date('now') AND date(m.expiry_date) <= date('now', '+60 days')`;
  }
  sql += ' ORDER BY m.name ASC';
  res.json({ ok: true, medicines: db.prepare(sql).all(...params) });
});

function validateMedicine(b) {
  const name = cleanStr(b.name, 150);
  if (!name) return 'ওষুধের নাম দিন।';
  const purchase_price = asInt(b.purchase_price);
  const sale_price = asInt(b.sale_price);
  const stock = asInt(b.stock);
  const reorder_level = asInt(b.reorder_level);
  if (purchase_price < 0 || sale_price < 0 || stock < 0 || reorder_level < 0) {
    return 'দাম ও স্টক শূন্য বা তার বেশি হতে হবে।';
  }
  if (b.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.expiry_date))) return 'মেয়াদের তারিখ YYYY-MM-DD ফরম্যাটে দিন।';
  return null;
}

app.post('/api/medicines', ...pharmacyApi, (req, res) => {
  const e = validateMedicine(req.body);
  if (e) return err(res, 400, e);
  const b = req.body;
  const info = db.prepare(
    `INSERT INTO medicines (name, generic_name, manufacturer, unit, purchase_price, sale_price, stock, reorder_level, expiry_date, supplier_id, sku, store_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cleanStr(b.name, 150), cleanStr(b.generic_name), cleanStr(b.manufacturer), cleanStr(b.unit, 20) || 'পিস',
    asInt(b.purchase_price), asInt(b.sale_price), asInt(b.stock), asInt(b.reorder_level),
    cleanStr(b.expiry_date, 10), b.supplier_id ? asInt(b.supplier_id) : null, cleanStr(b.sku, 50),
    cleanStr(b.store_number, 50)
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/medicines/:id', ...pharmacyApi, (req, res) => {
  const id = asInt(req.params.id);
  if (!db.prepare('SELECT id FROM medicines WHERE id = ?').get(id)) return err(res, 404, 'ওষুধ পাওয়া যায়নি।');
  const e = validateMedicine(req.body);
  if (e) return err(res, 400, e);
  const b = req.body;
  db.prepare(
    `UPDATE medicines SET name=?, generic_name=?, manufacturer=?, unit=?, purchase_price=?, sale_price=?,
     stock=?, reorder_level=?, expiry_date=?, supplier_id=?, sku=?, store_number=? WHERE id=?`
  ).run(
    cleanStr(b.name, 150), cleanStr(b.generic_name), cleanStr(b.manufacturer), cleanStr(b.unit, 20) || 'পিস',
    asInt(b.purchase_price), asInt(b.sale_price), asInt(b.stock), asInt(b.reorder_level),
    cleanStr(b.expiry_date, 10), b.supplier_id ? asInt(b.supplier_id) : null, cleanStr(b.sku, 50),
    cleanStr(b.store_number, 50), id
  );
  res.json({ ok: true });
});

app.delete('/api/medicines/:id', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const id = asInt(req.params.id);
  const used = db.prepare('SELECT (SELECT COUNT(*) FROM sale_items WHERE medicine_id=?) + (SELECT COUNT(*) FROM purchase_items WHERE medicine_id=?) AS c').get(id, id).c;
  if (used > 0) return err(res, 400, 'এই ওষুধের বিক্রি/ক্রয়ের রেকর্ড আছে, তাই মুছে ফেলা যাবে না।');
  db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
app.get('/api/suppliers', ...pharmacyApi, (req, res) => {
  res.json({ ok: true, suppliers: db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all() });
});

app.post('/api/suppliers', ...pharmacyApi, (req, res) => {
  const name = cleanStr(req.body.name, 150);
  if (!name) return err(res, 400, 'সাপ্লায়ারের নাম দিন।');
  const info = db.prepare('INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)')
    .run(name, cleanStr(req.body.phone, 30), cleanStr(req.body.address));
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/suppliers/:id', ...pharmacyApi, (req, res) => {
  const id = asInt(req.params.id);
  const name = cleanStr(req.body.name, 150);
  if (!name) return err(res, 400, 'সাপ্লায়ারের নাম দিন।');
  db.prepare('UPDATE suppliers SET name=?, phone=?, address=? WHERE id=?')
    .run(name, cleanStr(req.body.phone, 30), cleanStr(req.body.address), id);
  res.json({ ok: true });
});

app.delete('/api/suppliers/:id', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const id = asInt(req.params.id);
  db.prepare('UPDATE medicines SET supplier_id = NULL WHERE supplier_id = ?').run(id);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Purchases (stock-in)
// ---------------------------------------------------------------------------
app.get('/api/purchases', ...pharmacyApi, (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, COALESCE(s.name, '-') AS supplier_name FROM purchases p
     LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.id DESC LIMIT 100`
  ).all();
  res.json({ ok: true, purchases: rows });
});

app.post('/api/purchases', ...pharmacyApi, (req, res) => {
  const { supplier_id, invoice_no, items, paid, date } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return err(res, 400, 'কমপক্ষে একটি আইটেম যোগ করুন।');
  const paidAmt = asInt(paid);
  if (paidAmt < 0) return err(res, 400, 'পরিশোধের পরিমাণ সঠিক নয়।');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : todayStr();

  let total = 0;
  const norm = [];
  for (const it of items) {
    const mid = asInt(it.medicine_id);
    const qty = asInt(it.qty);
    const price = asInt(it.price);
    if (!mid || qty <= 0 || price < 0) return err(res, 400, 'আইটেমের পরিমাণ/দাম সঠিক নয়।');
    const med = db.prepare('SELECT id FROM medicines WHERE id = ?').get(mid);
    if (!med) return err(res, 400, 'একটি ওষুধ পাওয়া যায়নি।');
    total += qty * price;
    norm.push({ mid, qty, price });
  }
  if (paidAmt > total) return err(res, 400, 'পরিশোধ মোট টাকার বেশি হতে পারবে না।');

  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO purchases (supplier_id, invoice_no, total, paid, due, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(supplier_id ? asInt(supplier_id) : null, cleanStr(invoice_no, 50), total, paidAmt, total - paidAmt, d, req.user.userId);
    const pid = info.lastInsertRowid;
    const insItem = db.prepare('INSERT INTO purchase_items (purchase_id, medicine_id, qty, price) VALUES (?, ?, ?, ?)');
    const bump = db.prepare('UPDATE medicines SET stock = stock + ? WHERE id = ?');
    for (const it of norm) {
      insItem.run(pid, it.mid, it.qty, it.price);
      bump.run(it.qty, it.mid);
    }
    return pid;
  });
  const pid = tx();
  res.json({ ok: true, id: pid, total, due: total - paidAmt });
});

// ---------------------------------------------------------------------------
// Sales (POS)
// ---------------------------------------------------------------------------
app.get('/api/sales', ...pharmacyApi, (req, res) => {
  const rows = db.prepare('SELECT * FROM sales ORDER BY id DESC LIMIT 100').all();
  res.json({ ok: true, sales: rows });
});

app.get('/api/sales/:id', ...pharmacyApi, (req, res) => {
  const id = asInt(req.params.id);
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) return err(res, 404, 'বিক্রি পাওয়া যায়নি।');
  const items = db.prepare(
    `SELECT si.*, COALESCE(m.name, '—') AS medicine_name, COALESCE(m.unit, '') AS unit
     FROM sale_items si LEFT JOIN medicines m ON m.id = si.medicine_id WHERE si.sale_id = ?`
  ).all(id);
  res.json({ ok: true, sale, items, settings: getAllSettings() });
});

app.post('/api/sales', ...pharmacyApi, (req, res) => {
  const { customer_name, customer_phone, items, discount, paid, date } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return err(res, 400, 'কমপক্ষে একটি আইটেম যোগ করুন।');
  const disc = asInt(discount);
  const paidAmt = asInt(paid);
  if (disc < 0 || paidAmt < 0) return err(res, 400, 'ছাড়/পরিশোধের পরিমাণ সঠিক নয়।');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : todayStr();

  let subtotal = 0;
  const norm = [];
  for (const it of items) {
    const mid = asInt(it.medicine_id);
    const qty = asInt(it.qty);
    if (!mid || qty <= 0) return err(res, 400, 'আইটেমের পরিমাণ সঠিক নয়।');
    const med = db.prepare('SELECT id, name, sale_price, stock FROM medicines WHERE id = ?').get(mid);
    if (!med) return err(res, 400, 'একটি ওষুধ পাওয়া যায়নি।');
    if (med.stock < qty) return err(res, 400, `"${med.name}"-এর স্টক পর্যাপ্ত নয় (আছে ${med.stock})।`);
    subtotal += qty * med.sale_price;
    norm.push({ mid, qty, price: med.sale_price });
  }
  const total = subtotal - disc;
  if (total < 0) return err(res, 400, 'ছাড় মোট টাকার বেশি হতে পারবে না।');
  if (paidAmt > total) return err(res, 400, 'পরিশোধ মোট টাকার বেশি হতে পারবে না.');

  const tx = db.transaction(() => {
    const invoice_no = 'INV-' + Date.now();
    const info = db.prepare(
      'INSERT INTO sales (invoice_no, customer_name, customer_phone, total, discount, paid, due, date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(invoice_no, cleanStr(customer_name, 100), cleanStr(customer_phone, 30), total, disc, paidAmt, total - paidAmt, d, req.user.userId);
    const sid = info.lastInsertRowid;
    const insItem = db.prepare('INSERT INTO sale_items (sale_id, medicine_id, qty, price) VALUES (?, ?, ?, ?)');
    const dec = db.prepare('UPDATE medicines SET stock = stock - ? WHERE id = ?');
    for (const it of norm) {
      insItem.run(sid, it.mid, it.qty, it.price);
      dec.run(it.qty, it.mid);
    }
    return { sid, invoice_no };
  });
  const { sid, invoice_no } = tx();
  res.json({ ok: true, id: sid, invoice_no, total, due: total - paidAmt });
});

// ---------------------------------------------------------------------------
// Dues (বকেয়া)
// ---------------------------------------------------------------------------
app.get('/api/dues', ...pharmacyApi, (req, res) => {
  const sales = db.prepare('SELECT id, invoice_no, customer_name, customer_phone, total, paid, due, date FROM sales WHERE due > 0 ORDER BY id DESC').all();
  const purchases = db.prepare(
    `SELECT p.id, p.invoice_no, p.total, p.paid, p.due, p.date, COALESCE(s.name, '-') AS supplier_name
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.due > 0 ORDER BY p.id DESC`
  ).all();
  res.json({ ok: true, sales, purchases });
});

app.post('/api/dues/collect', ...pharmacyApi, (req, res) => {
  const { type, id, amount } = req.body || {};
  const amt = asInt(amount);
  const rid = asInt(id);
  if ((type !== 'sale' && type !== 'purchase') || !rid || amt <= 0) {
    return err(res, 400, 'তথ্য সঠিক নয়।');
  }
  const table = type === 'sale' ? 'sales' : 'purchases';
  const row = db.prepare(`SELECT due, paid FROM ${table} WHERE id = ?`).get(rid);
  if (!row) return err(res, 404, 'রেকর্ড পাওয়া যায়নি।');
  if (amt > row.due) return err(res, 400, `বকেয়ার বেশি টাকা নেওয়া যাবে না (বকেয়া ৳${row.due})।`);
  db.prepare(`UPDATE ${table} SET paid = paid + ?, due = due - ? WHERE id = ?`).run(amt, amt, rid);
  res.json({ ok: true, due: row.due - amt });
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
app.get('/api/reports/sales', ...pharmacyApi, (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || '')) ? String(req.query.from) : todayStr();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || '')) ? String(req.query.to) : todayStr();
  const rows = db.prepare('SELECT * FROM sales WHERE date BETWEEN ? AND ? ORDER BY id DESC').all(from, to);
  const totals = db.prepare(
    'SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total, COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(paid),0) AS paid, COALESCE(SUM(due),0) AS due FROM sales WHERE date BETWEEN ? AND ?'
  ).get(from, to);
  res.json({ ok: true, from, to, sales: rows, totals });
});

app.get('/api/reports/stock', ...pharmacyApi, (req, res) => {
  const rows = db.prepare(
    `SELECT m.*, COALESCE(s.name,'') AS supplier_name, (m.stock * m.sale_price) AS stock_value
     FROM medicines m LEFT JOIN suppliers s ON s.id = m.supplier_id ORDER BY m.name ASC`
  ).all();
  const totalValue = rows.reduce((a, r) => a + (r.stock_value || 0), 0);
  res.json({ ok: true, medicines: rows, totalValue });
});

// ---------------------------------------------------------------------------
// Users (master_admin only)
// ---------------------------------------------------------------------------
app.get('/api/users', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const rows = db.prepare(
    "SELECT id, username, full_name, role, active, created_at FROM users WHERE role != 'super_admin' ORDER BY id ASC"
  ).all();
  res.json({ ok: true, users: rows });
});

app.post('/api/users', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const { username, password, fullName, role } = req.body || {};
  if (!cleanStr(username) || !password || !cleanStr(fullName)) return err(res, 400, 'সব ঘর পূরণ করুন।');
  if (String(password).length < 4) return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  const r = role === 'master_admin' ? 'master_admin' : 'staff';
  const uname = cleanStr(username, 100).toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return err(res, 400, 'এই ইউজারনেম ইতিমধ্যে ব্যবহার হয়েছে।');
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare('INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(uname, hash, cleanStr(fullName, 100), r);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/users/:id/status', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const id = asInt(req.params.id);
  if (id === req.user.userId) return err(res, 400, 'নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।');
  const u = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
  if (!u || u.role === 'super_admin') return err(res, 404, 'ইউজার পাওয়া যায়নি।');
  const active = req.body.active ? 1 : 0;
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active, id);
  // Kill that user's sessions
  for (const [t, s] of sessions) { if (s.userId === id) sessions.delete(t); }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
app.get('/api/settings', ...pharmacyApi, (req, res) => {
  res.json({ ok: true, settings: getAllSettings() });
});

app.put('/api/settings', ...pharmacyApi, requireRole('master_admin'), (req, res) => {
  const b = req.body || {};
  if (b.pharmacy_name !== undefined) setSetting('pharmacy_name', cleanStr(b.pharmacy_name, 150));
  if (b.pharmacy_phone !== undefined) setSetting('pharmacy_phone', cleanStr(b.pharmacy_phone, 30));
  if (b.pharmacy_address !== undefined) setSetting('pharmacy_address', cleanStr(b.pharmacy_address));
  if (b.invoice_footer !== undefined) setSetting('invoice_footer', cleanStr(b.invoice_footer));
  res.json({ ok: true, settings: getAllSettings() });
});

// ---------------------------------------------------------------------------
// Builder (Super Admin) — separate portal
// ---------------------------------------------------------------------------
const builderApi = [auth, requireRole('super_admin')];

app.get('/api/builder/status', ...builderApi, (req, res) => {
  res.json({
    ok: true,
    online: getSetting('software_online') === '1',
    maintenanceMessage: getSetting('maintenance_message'),
  });
});

app.post('/api/builder/toggle', ...builderApi, (req, res) => {
  const online = !!req.body.online;
  setSetting('software_online', online ? '1' : '0');
  res.json({ ok: true, online });
});

app.put('/api/builder/maintenance-message', ...builderApi, (req, res) => {
  const message = cleanStr(req.body.message, 500);
  if (!message) return err(res, 400, 'বার্তা খালি রাখা যাবে না।');
  setSetting('maintenance_message', message);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/builder', (req, res) => res.sendFile(path.join(__dirname, 'public', 'builder.html')));

// 404 for unknown API routes
app.use('/api', (req, res) => err(res, 404, 'পাওয়া যায়নি।'));

app.listen(PORT, () => {
  console.log(`Farmacy App চলছে: http://localhost:${PORT}`);
  console.log(`Builder portal: http://localhost:${PORT}/builder`);
});
