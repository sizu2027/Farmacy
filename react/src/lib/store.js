/* store.js — Fully client-side data layer for the Farmacy React app.
 *
 * All data persists in localStorage under key `farmacy_react_v1`.
 * Passwords are SHA-256 hashed (crypto.subtle) — never stored plaintext.
 * Sessions live in sessionStorage (separate keys for pharmacy & builder portals).
 *
 * Collections:
 *  users:     {id, username, password_hash, full_name, role, active, created_at}
 *  medicines: {id, name, generic_name, company, strength, form, store_number,
 *              purchase_price, sale_price, stock, reorder_level, expiry_date,
 *              supplier_id, sku, unit, created_at}
 *  suppliers: {id, name, phone, address, created_at}
 *  purchases: {id, supplier_id, invoice_no, items:[{medicine_id, qty, price}],
 *              total, paid, due, date, created_by, created_at}
 *  sales:     {id, invoice_no, customer_name, customer_phone,
 *              items:[{medicine_id, name, qty, price}],
 *              total, discount, paid, due, date, created_by, created_at}
 *  settings:  {pharmacy_name, pharmacy_phone, pharmacy_address, invoice_footer,
 *              low_stock_threshold, expiry_alert_days,
 *              maintenance_mode ('1'|'0'), maintenance_message}
 *
 * Roles: 'master_admin' | 'staff' | 'super_admin' (builder only)
 *
 * API (all errors thrown with Bengali messages):
 *  seedIfNeeded()
 *  sha256(str) -> Promise<hex>
 *  setupMaster({pharmacyName, fullName, username, password}) -> {user, session}
 *  setupBuilder({fullName, builderId, password}) -> {user, session}
 *  login(username, password, portal) -> {user, session}   // portal: 'pharmacy'|'builder'
 *  logout(portal)
 *  getSession(portal) -> {user, session} | null
 *  getSettings() / updateSettings(patch) / setMaintenanceMode(online) / setMaintenanceMessage(msg)
 *  listMedicines({q, lowstock, expiring}) / addMedicine(data) / updateMedicine(id, data) / deleteMedicine(id)
 *  listSuppliers() / addSupplier(data) / updateSupplier(id, data) / deleteSupplier(id)
 *  listPurchases() / addPurchase({supplier_id, invoice_no, items, paid, date})
 *  listSales() / getSale(id) / addSale({customer_name, customer_phone, items, discount, paid, date})
 *  getDues() -> {sales:[], purchases:[]} / collectDue(type, id, amount)
 *  dashboard() -> {stats, alerts:{lowStock, expiring}, recentSales, recentPurchases, settings}
 *  salesReport(from, to) -> {sales, totals} / stockReport() -> {medicines, totalValue}
 *  listUsers() / addUser(data) / setUserActive(id, active)
 *  helpers: fmt(n) -> '৳...', num(n), esc via React (not needed), todayStr(), uid()
 */

const DB_KEY = 'farmacy_react_v1';
const SESSION_KEY = 'farmacy_react_session';
const BUILDER_SESSION_KEY = 'farmacy_react_builder_session';

const DEFAULT_SETTINGS = {
  software_online: '1',
  maintenance_mode: '1', // '1' = ON (software works), '0' = OFF (maintenance page)
  maintenance_message: 'সিস্টেম রক্ষণাবেক্ষণের কাজ চলছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
  invoice_footer: 'সুস্থ থাকুন, ধন্যবাদ।',
  pharmacy_name: '',
  pharmacy_phone: '',
  pharmacy_address: '',
  low_stock_threshold: 10,
  expiry_alert_days: 60,
};

function emptyDb() {
  return {
    users: [],
    medicines: [],
    suppliers: [],
    purchases: [],
    sales: [],
    settings: { ...DEFAULT_SETTINGS },
    seq: 1,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // migrate: make sure all collections exist
      const e = emptyDb();
      return { ...e, ...d, settings: { ...e.settings, ...(d.settings || {}) }, seq: d.seq || 1 };
    }
  } catch (e) { /* corrupted -> reseed */ }
  return emptyDb();
}

function save(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(db) {
  return db.seq++;
}

export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmt(n) {
  return '৳' + Number(n || 0).toLocaleString('bn-BD');
}
export function num(n) {
  return Number(n || 0).toLocaleString('bn-BD');
}

export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const asInt = (v, f = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : f;
};
const cleanStr = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

/* ---------------- Seed demo data (first run) ---------------- */
export function seedIfNeeded() {
  const db = load();
  const hasMaster = db.users.some((u) => u.role === 'master_admin');
  if (hasMaster || db.medicines.length > 0) return; // already set up / has data
  // Demo supplier
  const supId = uid(db);
  db.suppliers.push({ id: supId, name: 'ডেমো ডিস্ট্রিবিউটর', phone: '01XXXXXXXXX', address: 'ঢাকা', created_at: todayStr() });
  // Demo medicines (clearly demo)
  const demo = [
    { name: 'নাপা ৫০০', generic_name: 'Paracetamol', company: 'Beximco', strength: '500mg', form: 'Tablet', store_number: 'A-01', purchase_price: 1, sale_price: 2, stock: 500, reorder_level: 50, expiry_date: '2027-12-31', supplier_id: supId, sku: '', unit: 'পিস' },
    { name: 'সেকলো ২০', generic_name: 'Omeprazole', company: 'Square', strength: '20mg', form: 'Capsule', store_number: 'A-02', purchase_price: 4, sale_price: 6, stock: 8, reorder_level: 20, expiry_date: '2026-06-30', supplier_id: supId, sku: '', unit: 'পিস' },
    { name: 'এজিথ ৫০০', generic_name: 'Azithromycin', company: 'Square', strength: '500mg', form: 'Tablet', store_number: 'B-05', purchase_price: 25, sale_price: 35, stock: 100, reorder_level: 30, expiry_date: '2026-11-15', supplier_id: supId, sku: '', unit: 'পিস' },
  ];
  for (const m of demo) {
    db.medicines.push({ id: uid(db), ...m, created_at: todayStr() });
  }
  save(db);
}

/* ---------------- Settings ---------------- */
export function getSettings() {
  return load().settings;
}
export function updateSettings(patch) {
  const db = load();
  const s = db.settings;
  if (patch.pharmacy_name !== undefined) s.pharmacy_name = cleanStr(patch.pharmacy_name, 150);
  if (patch.pharmacy_phone !== undefined) s.pharmacy_phone = cleanStr(patch.pharmacy_phone, 30);
  if (patch.pharmacy_address !== undefined) s.pharmacy_address = cleanStr(patch.pharmacy_address);
  if (patch.invoice_footer !== undefined) s.invoice_footer = cleanStr(patch.invoice_footer);
  if (patch.low_stock_threshold !== undefined) s.low_stock_threshold = asInt(patch.low_stock_threshold, 10);
  if (patch.expiry_alert_days !== undefined) s.expiry_alert_days = asInt(patch.expiry_alert_days, 60);
  save(db);
  return { ...s };
}
export function setMaintenanceMode(online) {
  const db = load();
  db.settings.maintenance_mode = online ? '1' : '0';
  db.settings.software_online = online ? '1' : '0';
  save(db);
  return online;
}
export function setMaintenanceMessage(msg) {
  const m = cleanStr(msg, 500);
  if (!m) throw new Error('বার্তা খালি রাখা যাবে না।');
  const db = load();
  db.settings.maintenance_message = m;
  save(db);
}
export function isSoftwareOnline() {
  const s = getSettings();
  return (s.maintenance_mode || s.software_online) === '1';
}

/* ---------------- Auth ---------------- */
function sessionKey(portal) {
  return portal === 'builder' ? BUILDER_SESSION_KEY : SESSION_KEY;
}
function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role };
}
function storeSession(portal, user) {
  const session = newToken();
  sessionStorage.setItem(sessionKey(portal), JSON.stringify({ session, user: publicUser(user) }));
  return { user: publicUser(user), session };
}
export function getSession(portal) {
  try {
    const raw = sessionStorage.getItem(sessionKey(portal));
    if (!raw) return null;
    const { user } = JSON.parse(raw);
    // verify user still exists & active
    const db = load();
    const u = db.users.find((x) => x.id === user.id);
    if (!u || !u.active) {
      sessionStorage.removeItem(sessionKey(portal));
      return null;
    }
    // role/portal isolation
    if (portal === 'builder' && u.role !== 'super_admin') return null;
    if (portal === 'pharmacy' && u.role === 'super_admin') return null;
    return { user: publicUser(u) };
  } catch (e) {
    return null;
  }
}
export function logout(portal) {
  sessionStorage.removeItem(sessionKey(portal));
}
export function needsMasterSetup() {
  const db = load();
  return !db.users.some((u) => u.role === 'master_admin');
}
export function needsBuilderSetup() {
  const db = load();
  return !db.users.some((u) => u.role === 'super_admin');
}

export async function setupMaster({ pharmacyName, fullName, username, password }) {
  if (!cleanStr(pharmacyName) || !cleanStr(fullName) || !cleanStr(username) || !password) {
    throw new Error('সব ঘর পূরণ করুন।');
  }
  if (String(password).length < 4) throw new Error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  const db = load();
  if (db.users.some((u) => u.role === 'master_admin')) {
    throw new Error('মাস্টার অ্যাডমিন ইতিমধ্যে তৈরি আছে। সরাসরি লগইন করুন।');
  }
  const uname = cleanStr(username, 100).toLowerCase();
  if (db.users.some((u) => u.username === uname)) throw new Error('এই ইউজারনেম ইতিমধ্যে ব্যবহার হয়েছে।');
  const hash = await sha256(String(password));
  const user = {
    id: uid(db), username: uname, password_hash: hash,
    full_name: cleanStr(fullName, 100), role: 'master_admin', active: 1, created_at: todayStr(),
  };
  db.users.push(user);
  db.settings.pharmacy_name = cleanStr(pharmacyName, 150);
  save(db);
  return storeSession('pharmacy', user);
}

export async function setupBuilder({ fullName, builderId, password }) {
  if (!cleanStr(fullName) || !cleanStr(builderId) || !password) {
    throw new Error('সব ঘর পূরণ করুন।');
  }
  if (String(password).length < 4) throw new Error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  const db = load();
  if (db.users.some((u) => u.role === 'super_admin')) {
    throw new Error('বিল্ডার অ্যাকাউন্ট ইতিমধ্যে তৈরি আছে। সরাসরি লগইন করুন।');
  }
  const uname = cleanStr(builderId, 100).toLowerCase();
  if (db.users.some((u) => u.username === uname)) throw new Error('এই বিল্ডার আইডি ইতিমধ্যে ব্যবহার হয়েছে।');
  const hash = await sha256(String(password));
  const user = {
    id: uid(db), username: uname, password_hash: hash,
    full_name: cleanStr(fullName, 100), role: 'super_admin', active: 1, created_at: todayStr(),
  };
  db.users.push(user);
  save(db);
  return storeSession('builder', user);
}

export async function login(username, password, portal) {
  if (!username || !password) throw new Error('ইউজারনেম ও পাসওয়ার্ড দিন।');
  const p = portal === 'builder' ? 'builder' : 'pharmacy';
  const db = load();
  const u = db.users.find((x) => x.username === cleanStr(username, 100).toLowerCase());
  if (!u || !u.active) throw new Error('ভুল ইউজারনেম বা পাসওয়ার্ড।');
  const hash = await sha256(String(password));
  if (hash !== u.password_hash) throw new Error('ভুল ইউজারনেম বা পাসওয়ার্ড।');
  if (p === 'builder' && u.role !== 'super_admin') {
    throw new Error('এই পোর্টাল শুধু সফটওয়্যার নির্মাতার জন্য।');
  }
  if (p === 'pharmacy' && u.role === 'super_admin') {
    throw new Error('সুপার অ্যাডমিন ফার্মেসি পোর্টালে লগইন করতে পারবে না। নির্মাতার পোর্টাল ব্যবহার করুন।');
  }
  if (p === 'pharmacy' && !isSoftwareOnline()) {
    const err = new Error(getSettings().maintenance_message);
    err.maintenance = true;
    throw err;
  }
  return storeSession(p, u);
}

/* ---------------- Medicines ---------------- */
export function listMedicines({ q = '', lowstock = false, expiring = false } = {}) {
  const db = load();
  const s = db.settings;
  const alertDays = asInt(s.expiry_alert_days, 60);
  const today = todayStr();
  const limit = addDays(today, alertDays);
  let rows = db.medicines.slice();
  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter((m) =>
      (m.name || '').toLowerCase().includes(qq) ||
      (m.generic_name || '').toLowerCase().includes(qq) ||
      (m.sku || '').toLowerCase().includes(qq)
    );
  }
  if (lowstock) rows = rows.filter((m) => (m.stock || 0) <= (m.reorder_level || 0));
  if (expiring) {
    rows = rows.filter((m) => m.expiry_date && m.expiry_date >= today && m.expiry_date <= limit);
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'bn'));
  return rows.map((m) => ({
    ...m,
    supplier_name: m.supplier_id ? (db.suppliers.find((x) => x.id === m.supplier_id) || {}).name || '' : '',
  }));
}

function validateMedicine(b) {
  const name = cleanStr(b.name, 150);
  if (!name) return 'ওষুধের নাম দিন।';
  if (asInt(b.purchase_price) < 0 || asInt(b.sale_price) < 0 || asInt(b.stock) < 0 || asInt(b.reorder_level) < 0) {
    return 'দাম ও স্টক শূন্য বা তার বেশি হতে হবে।';
  }
  if (b.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.expiry_date))) {
    return 'মেয়াদের তারিখ YYYY-MM-DD ফরম্যাটে দিন।';
  }
  return null;
}

function normMedicine(b) {
  return {
    name: cleanStr(b.name, 150),
    generic_name: cleanStr(b.generic_name),
    company: cleanStr(b.company || b.manufacturer),
    manufacturer: cleanStr(b.manufacturer || b.company),
    strength: cleanStr(b.strength, 50),
    form: cleanStr(b.form, 50),
    unit: cleanStr(b.unit, 20) || 'পিস',
    purchase_price: asInt(b.purchase_price),
    sale_price: asInt(b.sale_price),
    stock: asInt(b.stock),
    reorder_level: asInt(b.reorder_level),
    expiry_date: cleanStr(b.expiry_date, 10),
    supplier_id: b.supplier_id ? asInt(b.supplier_id) : null,
    sku: cleanStr(b.sku, 50),
    store_number: cleanStr(b.store_number, 50),
  };
}

export function addMedicine(data) {
  const e = validateMedicine(data);
  if (e) throw new Error(e);
  const db = load();
  const m = { id: uid(db), ...normMedicine(data), created_at: todayStr() };
  db.medicines.push(m);
  save(db);
  return m.id;
}
export function updateMedicine(id, data) {
  const e = validateMedicine(data);
  if (e) throw new Error(e);
  const db = load();
  const m = db.medicines.find((x) => x.id === id);
  if (!m) throw new Error('ওষুধ পাওয়া যায়নি।');
  Object.assign(m, normMedicine(data));
  save(db);
}
export function deleteMedicine(id) {
  const db = load();
  const usedSale = db.sales.some((s) => (s.items || []).some((it) => it.medicine_id === id));
  const usedPur = db.purchases.some((p) => (p.items || []).some((it) => it.medicine_id === id));
  if (usedSale || usedPur) throw new Error('এই ওষুধের বিক্রি/ক্রয়ের রেকর্ড আছে, তাই মুছে ফেলা যাবে না।');
  db.medicines = db.medicines.filter((x) => x.id !== id);
  save(db);
}

/* ---------------- Suppliers ---------------- */
export function listSuppliers() {
  const db = load();
  return db.suppliers.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'bn'));
}
export function addSupplier(data) {
  const name = cleanStr(data.name, 150);
  if (!name) throw new Error('সাপ্লায়ারের নাম দিন।');
  const db = load();
  const s = { id: uid(db), name, phone: cleanStr(data.phone, 30), address: cleanStr(data.address), created_at: todayStr() };
  db.suppliers.push(s);
  save(db);
  return s.id;
}
export function updateSupplier(id, data) {
  const name = cleanStr(data.name, 150);
  if (!name) throw new Error('সাপ্লায়ারের নাম দিন।');
  const db = load();
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) throw new Error('সাপ্লায়ার পাওয়া যায়নি।');
  s.name = name; s.phone = cleanStr(data.phone, 30); s.address = cleanStr(data.address);
  save(db);
}
export function deleteSupplier(id) {
  const db = load();
  db.medicines.forEach((m) => { if (m.supplier_id === id) m.supplier_id = null; });
  db.suppliers = db.suppliers.filter((x) => x.id !== id);
  save(db);
}

/* ---------------- Purchases ---------------- */
export function listPurchases() {
  const db = load();
  return db.purchases.slice().reverse().slice(0, 100).map((p) => ({
    ...p,
    supplier_name: p.supplier_id ? (db.suppliers.find((x) => x.id === p.supplier_id) || {}).name || '-' : '-',
  }));
}
export function addPurchase({ supplier_id, invoice_no, items, paid, date }, createdBy) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('কমপক্ষে একটি আইটেম যোগ করুন।');
  const paidAmt = asInt(paid);
  if (paidAmt < 0) throw new Error('পরিশোধের পরিমাণ সঠিক নয়।');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : todayStr();
  const db = load();
  let total = 0;
  const norm = [];
  for (const it of items) {
    const mid = asInt(it.medicine_id);
    const qty = asInt(it.qty);
    const price = asInt(it.price);
    if (!mid || qty <= 0 || price < 0) throw new Error('আইটেমের পরিমাণ/দাম সঠিক নয়।');
    const med = db.medicines.find((m) => m.id === mid);
    if (!med) throw new Error('একটি ওষুধ পাওয়া যায়নি।');
    total += qty * price;
    norm.push({ medicine_id: mid, qty, price });
  }
  if (paidAmt > total) throw new Error('পরিশোধ মোট টাকার বেশি হতে পারবে না।');
  const p = {
    id: uid(db),
    supplier_id: supplier_id ? asInt(supplier_id) : null,
    invoice_no: cleanStr(invoice_no, 50),
    items: norm, total, paid: paidAmt, due: total - paidAmt,
    date: d, created_by: createdBy || null, created_at: todayStr(),
  };
  db.purchases.push(p);
  // stock-in
  for (const it of norm) {
    const med = db.medicines.find((m) => m.id === it.medicine_id);
    if (med) med.stock = (med.stock || 0) + it.qty;
  }
  save(db);
  return { id: p.id, total, due: total - paidAmt };
}

/* ---------------- Sales (POS) ---------------- */
export function listSales() {
  const db = load();
  return db.sales.slice().reverse().slice(0, 100);
}
export function getSale(id) {
  const db = load();
  const s = db.sales.find((x) => x.id === id);
  if (!s) throw new Error('বিক্রি পাওয়া যায়নি।');
  const items = (s.items || []).map((it) => {
    const m = db.medicines.find((x) => x.id === it.medicine_id) || {};
    return { ...it, medicine_name: it.name || m.name || '—', unit: m.unit || '' };
  });
  return { sale: s, items, settings: db.settings };
}
export function addSale({ customer_name, customer_phone, items, discount, paid, date }, createdBy) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('কমপক্ষে একটি আইটেম যোগ করুন।');
  const disc = asInt(discount);
  const paidAmt = asInt(paid);
  if (disc < 0 || paidAmt < 0) throw new Error('ছাড়/পরিশোধের পরিমাণ সঠিক নয়।');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : todayStr();
  const db = load();
  let subtotal = 0;
  const norm = [];
  for (const it of items) {
    const mid = asInt(it.medicine_id);
    const qty = asInt(it.qty);
    if (!mid || qty <= 0) throw new Error('আইটেমের পরিমাণ সঠিক নয়।');
    const med = db.medicines.find((m) => m.id === mid);
    if (!med) throw new Error('একটি ওষুধ পাওয়া যায়নি।');
    if ((med.stock || 0) < qty) throw new Error(`"${med.name}"-এর স্টক পর্যাপ্ত নয় (আছে ${med.stock})।`);
    subtotal += qty * (med.sale_price || 0);
    norm.push({ medicine_id: mid, name: med.name, qty, price: med.sale_price || 0 });
  }
  const total = subtotal - disc;
  if (total < 0) throw new Error('ছাড় মোট টাকার বেশি হতে পারবে না।');
  if (paidAmt > total) throw new Error('পরিশোধ মোট টাকার বেশি হতে পারবে না।');
  const s = {
    id: uid(db),
    invoice_no: 'INV-' + Date.now(),
    customer_name: cleanStr(customer_name, 100),
    customer_phone: cleanStr(customer_phone, 30),
    items: norm, total, discount: disc, paid: paidAmt, due: total - paidAmt,
    date: d, created_by: createdBy || null, created_at: todayStr(),
  };
  db.sales.push(s);
  for (const it of norm) {
    const med = db.medicines.find((m) => m.id === it.medicine_id);
    if (med) med.stock = (med.stock || 0) - it.qty;
  }
  save(db);
  return { id: s.id, invoice_no: s.invoice_no, total, due: total - paidAmt };
}

/* ---------------- Dues ---------------- */
export function getDues() {
  const db = load();
  const sales = db.sales.filter((s) => (s.due || 0) > 0).reverse();
  const purchases = db.purchases.filter((p) => (p.due || 0) > 0).reverse().map((p) => ({
    ...p,
    supplier_name: p.supplier_id ? (db.suppliers.find((x) => x.id === p.supplier_id) || {}).name || '-' : '-',
  }));
  return { sales, purchases };
}
export function collectDue(type, id, amount) {
  const amt = asInt(amount);
  if ((type !== 'sale' && type !== 'purchase') || !id || amt <= 0) throw new Error('তথ্য সঠিক নয়।');
  const db = load();
  const coll = type === 'sale' ? db.sales : db.purchases;
  const row = coll.find((r) => r.id === id);
  if (!row) throw new Error('রেকর্ড পাওয়া যায়নি।');
  if (amt > (row.due || 0)) throw new Error(`বকেয়ার বেশি টাকা নেওয়া যাবে না (বকেয়া ৳${row.due})।`);
  row.paid = (row.paid || 0) + amt;
  row.due = (row.due || 0) - amt;
  save(db);
  return row.due;
}

/* ---------------- Dashboard / Reports ---------------- */
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dashboard() {
  const db = load();
  const s = db.settings;
  const today = todayStr();
  const alertDays = asInt(s.expiry_alert_days, 60);
  const limit = addDays(today, alertDays);
  const meds = db.medicines;
  const medicineCount = meds.length;
  const totalUnits = meds.reduce((a, m) => a + (m.stock || 0), 0);
  const stockValue = meds.reduce((a, m) => a + (m.stock || 0) * (m.sale_price || 0), 0);
  const lowStock = meds.filter((m) => (m.stock || 0) <= (m.reorder_level || 0)).slice(0, 20);
  const expiring = meds
    .filter((m) => m.expiry_date && m.expiry_date >= today && m.expiry_date <= limit)
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)))
    .slice(0, 20);
  const expiredCount = meds.filter((m) => m.expiry_date && m.expiry_date < today).length;
  const todaySalesRows = db.sales.filter((x) => x.date === today);
  const todaySales = todaySalesRows.reduce((a, x) => a + (x.total || 0), 0);
  const totalDue =
    db.sales.reduce((a, x) => a + (x.due || 0), 0) +
    db.purchases.reduce((a, x) => a + (x.due || 0), 0);
  const grossProfit = db.sales.reduce((a, sale) => {
    return a + (sale.items || []).reduce((b, it) => {
      const m = db.medicines.find((x) => x.id === it.medicine_id);
      return b + it.qty * ((it.price || 0) - ((m && m.purchase_price) || 0));
    }, 0);
  }, 0);
  const recentSales = db.sales.slice(-8).reverse();
  const recentPurchases = db.purchases.slice(-8).reverse().map((p) => ({
    ...p,
    supplier_name: p.supplier_id ? (db.suppliers.find((x) => x.id === p.supplier_id) || {}).name || '-' : '-',
  }));
  return {
    stats: {
      medicineCount, totalUnits, stockValue,
      lowStockCount: lowStock.length, expiringCount: expiring.length, expiredCount,
      todaySales, todayTransactions: todaySalesRows.length, totalDue, grossProfit,
    },
    alerts: { lowStock, expiring },
    recentSales, recentPurchases,
    settings: db.settings,
  };
}

export function salesReport(from, to) {
  const f = /^\d{4}-\d{2}-\d{2}$/.test(String(from || '')) ? String(from) : todayStr();
  const t = /^\d{4}-\d{2}-\d{2}$/.test(String(to || '')) ? String(to) : todayStr();
  const db = load();
  const sales = db.sales.filter((x) => x.date >= f && x.date <= t).reverse();
  const totals = {
    count: sales.length,
    total: sales.reduce((a, x) => a + (x.total || 0), 0),
    discount: sales.reduce((a, x) => a + (x.discount || 0), 0),
    paid: sales.reduce((a, x) => a + (x.paid || 0), 0),
    due: sales.reduce((a, x) => a + (x.due || 0), 0),
  };
  return { from: f, to: t, sales, totals };
}

export function stockReport() {
  const db = load();
  const medicines = db.medicines.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'bn')).map((m) => ({
    ...m,
    stock_value: (m.stock || 0) * (m.sale_price || 0),
    supplier_name: m.supplier_id ? (db.suppliers.find((x) => x.id === m.supplier_id) || {}).name || '' : '',
  }));
  const totalValue = medicines.reduce((a, m) => a + (m.stock_value || 0), 0);
  return { medicines, totalValue };
}

export function duesReport() {
  const { sales, purchases } = getDues();
  return {
    sales,
    purchases,
    totalDue: sales.reduce((a, x) => a + (x.due || 0), 0) + purchases.reduce((a, x) => a + (x.due || 0), 0),
  };
}

/* ---------------- Users ---------------- */
export function listUsers() {
  const db = load();
  return db.users.filter((u) => u.role !== 'super_admin').map(publicUserWithActive);
}
function publicUserWithActive(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role, active: u.active };
}
export async function addUser({ username, password, fullName, role }, currentUserId) {
  if (!cleanStr(username) || !password || !cleanStr(fullName)) throw new Error('সব ঘর পূরণ করুন।');
  if (String(password).length < 4) throw new Error('পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।');
  const r = role === 'master_admin' ? 'master_admin' : 'staff';
  const db = load();
  const uname = cleanStr(username, 100).toLowerCase();
  if (db.users.some((u) => u.username === uname)) throw new Error('এই ইউজারনেম ইতিমধ্যে ব্যবহার হয়েছে।');
  const hash = await sha256(String(password));
  const u = {
    id: uid(db), username: uname, password_hash: hash,
    full_name: cleanStr(fullName, 100), role: r, active: 1, created_at: todayStr(),
  };
  db.users.push(u);
  save(db);
  return u.id;
}
export function setUserActive(id, active, currentUserId) {
  if (id === currentUserId) throw new Error('নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না।');
  const db = load();
  const u = db.users.find((x) => x.id === id);
  if (!u || u.role === 'super_admin') throw new Error('ইউজার পাওয়া যায়নি।');
  u.active = active ? 1 : 0;
  save(db);
  // kill sessions of that user
  if (!active) {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw && JSON.parse(raw).user.id === id) sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }
}

export function roleName(r) {
  return r === 'master_admin' ? 'মাস্টার অ্যাডমিন' : r === 'staff' ? 'স্টাফ' : r === 'super_admin' ? 'সুপার অ্যাডমিন' : r;
}
