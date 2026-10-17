/* app.js — Pharmacy portal frontend. Vanilla JS + hash routing. All UI text in Bengali. */
(function () {
'use strict';

var $app = document.getElementById('app');
var TOKEN_KEY = 'fm_token';

var api = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  set token(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  },
  async call(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    var res;
    try {
      res = await fetch(path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('সার্ভারের সাথে সংযোগ করা যাচ্ছে না। ইন্টারনেট/সার্ভার চেক করুন।');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (res.status === 401) {
      this.token = null; state.user = null;
      renderLogin();
      throw new Error('__auth__');
    }
    if (res.status === 503 && data && data.maintenance) {
      showMaintenance(data.message);
      throw new Error('__maintenance__');
    }
    if (!res.ok) throw new Error((data && data.error) || 'একটি সমস্যা হয়েছে।');
    return data;
  },
  get: function (p) { return this.call('GET', p); },
  post: function (p, b) { return this.call('POST', p, b); },
  put: function (p, b) { return this.call('PUT', p, b); },
  del: function (p) { return this.call('DELETE', p); }
};

var state = { user: null, needsSetup: false, settings: {}, route: 'dashboard' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmt(n) { return '৳' + Number(n || 0).toLocaleString('bn-BD'); }
function num(n) { return Number(n || 0).toLocaleString('bn-BD'); }
function $(sel, root) { return (root || document).querySelector(sel); }

// Run an async page loader, showing its error message on failure.
async function safe(el, fn) {
  try { await fn(); }
  catch (e) {
    if (String(e.message).indexOf('__') === 0) return; // auth/maintenance already handled
    el.innerHTML = '<div class="error">' + esc(e.message) + '</div>';
  }
}

function fieldError(container, msg) {
  var box = $('.form-error', container);
  if (!box) return;
  if (msg) { box.textContent = msg; box.style.display = 'block'; }
  else { box.textContent = ''; box.style.display = 'none'; }
}

// ---------------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------------
function openModal(title, bodyHtml, onSubmit) {
  closeModal();
  var back = document.createElement('div');
  back.className = 'modal-back';
  back.id = 'modal-back';
  back.innerHTML =
    '<div class="modal"><h3>' + esc(title) + '</h3>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<form id="modal-form">' + bodyHtml +
    '<div class="modal-actions"><button type="button" class="btn ghost" id="modal-cancel">বাতিল</button>' +
    '<button type="submit" class="btn">সংরক্ষণ</button></div></form></div>';
  document.body.appendChild(back);
  $('#modal-cancel').addEventListener('click', closeModal);
  back.addEventListener('click', function (e) { if (e.target === back) closeModal(); });
  $('#modal-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var data = {};
    fd.forEach(function (v, k) { data[k] = v; });
    try {
      await onSubmit(data, e.target);
      closeModal();
    } catch (err2) {
      fieldError(back, err2.message);
    }
  });
}
function closeModal() {
  var m = $('#modal-back');
  if (m) m.remove();
}
function input(name, label, opts) {
  opts = opts || {};
  return '<div class="field' + (opts.full ? ' full' : '') + '"><label>' + esc(label) + '</label>' +
    '<input name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(opts.value || '') + '"' +
    (opts.required ? ' required' : '') + (opts.min !== undefined ? ' min="' + opts.min + '"' : '') +
    (opts.step ? ' step="' + opts.step + '"' : '') + '></div>';
}

// ---------------------------------------------------------------------------
// Auth screens
// ---------------------------------------------------------------------------
function renderSetup() {
  $app.innerHTML =
    '<div class="auth-wrap"><div class="auth-card">' +
    '<h1>💊 ফার্মেসি সফটওয়্যার</h1><p class="sub">প্রথমবার: মাস্টার অ্যাডমিন সেটআপ</p>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<form id="setup-form">' +
    '<div class="field"><label>ফার্মেসির নাম</label><input name="pharmacyName" required></div>' +
    '<div class="field"><label>আপনার নাম</label><input name="fullName" required></div>' +
    '<div class="field"><label>ইউজারনেম</label><input name="username" required autocomplete="username"></div>' +
    '<div class="field"><label>পাসওয়ার্ড</label><input name="password" type="password" required autocomplete="new-password"></div>' +
    '<button class="btn block" type="submit">সেটআপ সম্পন্ন করুন</button></form>' +
    '<div class="builder-link"><a href="builder.html">সফটওয়্যার নির্মাতার পোর্টাল</a></div>' +
    '</div></div>';
  $('#setup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    try {
      var d = await api.post('/api/setup-master', {
        pharmacyName: fd.get('pharmacyName'), fullName: fd.get('fullName'),
        username: fd.get('username'), password: fd.get('password')
      });
      api.token = d.token;
      state.user = d.user;
      state.needsSetup = false;
      location.hash = '#/dashboard';
      route();
    } catch (err2) { fieldError($app, err2.message); }
  });
}

function renderLogin() {
  $app.innerHTML =
    '<div class="auth-wrap"><div class="auth-card">' +
    '<h1>💊 ফার্মেসি লগইন</h1><p class="sub">মাস্টার অ্যাডমিন / স্টাফ</p>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<form id="login-form">' +
    '<div class="field"><label>ইউজারনেম</label><input name="username" required autocomplete="username"></div>' +
    '<div class="field"><label>পাসওয়ার্ড</label><input name="password" type="password" required autocomplete="current-password"></div>' +
    '<button class="btn block" type="submit">লগইন</button></form>' +
    '<div class="builder-link"><a href="builder.html">সফটওয়্যার নির্মাতার পোর্টাল</a></div>' +
    '</div></div>';
  $('#login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    try {
      var d = await api.post('/api/login', {
        username: fd.get('username'), password: fd.get('password'), portal: 'pharmacy'
      });
      api.token = d.token;
      state.user = d.user;
      location.hash = '#/dashboard';
      route();
    } catch (err2) {
      if (String(err2.message).indexOf('__') === 0) return;
      fieldError($app, err2.message);
    }
  });
}

function showMaintenance(message) {
  $app.innerHTML =
    '<div class="maintenance"><div class="box">' +
    '<h2>🛠️ রক্ষণাবেক্ষণ চলছে</h2>' +
    '<p>' + esc(message || 'সিস্টেম রক্ষণাবেক্ষণের কাজ চলছে।') + '</p>' +
    '<button class="btn" id="retry-btn">আবার চেষ্টা করুন</button></div></div>';
  $('#retry-btn').addEventListener('click', function () { boot(true); });
}

async function logout() {
  try { await api.post('/api/logout'); } catch (e) { /* ignore */ }
  api.token = null;
  state.user = null;
  location.hash = '#/dashboard';
  renderLogin();
}

// ---------------------------------------------------------------------------
// Shell + routing
// ---------------------------------------------------------------------------
var NAV = [
  ['dashboard', '📊 ড্যাশবোর্ড'],
  ['pos', '🧾 বিক্রি / POS'],
  ['medicines', '💊 ওষুধের মজুদ'],
  ['purchases', '🛒 ক্রয়'],
  ['suppliers', '🏭 সাপ্লায়ার'],
  ['dues', '💰 বকেয়া'],
  ['reports', '📈 রিপোর্ট'],
  ['users', '👥 ইউজার', 'master_admin'],
  ['settings', '⚙️ সেটিংস', 'master_admin'],
];

function renderShell() {
  var items = NAV.filter(function (n) { return !n[2] || state.user.role === n[2]; })
    .map(function (n) {
      return '<a href="#/' + n[0] + '" class="' + (state.route === n[0] ? 'active' : '') + '">' + n[1] + '</a>';
    }).join('');
  $app.innerHTML =
    '<div class="shell">' +
    '<aside class="sidebar" id="sidebar"><div class="brand">💊 ' + esc(state.settings.pharmacy_name || 'ফার্মেসি') + '</div>' +
    '<div class="who">' + esc(state.user.fullName) + ' (' + roleName(state.user.role) + ')</div>' +
    '<nav class="nav">' + items + '</nav></div>' +
    '<div class="main"><div class="topbar"><div>' +
    '<button class="btn ghost small menu-btn" id="menu-btn">☰ মেনু</button> ' +
    '<strong>' + pageTitle(state.route) + '</strong></div>' +
    '<button class="btn ghost small" id="logout-btn">লগআউট</button></div>' +
    '<div id="page"></div></div></div>';
  $('#logout-btn').addEventListener('click', logout);
  $('#menu-btn').addEventListener('click', function () { $('#sidebar').classList.toggle('open'); });
  var links = document.querySelectorAll('.nav a');
  links.forEach(function (a) {
    a.addEventListener('click', function () { $('#sidebar').classList.remove('open'); });
  });
}

function roleName(r) {
  return r === 'master_admin' ? 'মাস্টার অ্যাডমিন' : r === 'staff' ? 'স্টাফ' : r === 'super_admin' ? 'সুপার অ্যাডমিন' : r;
}
function pageTitle(r) {
  var f = NAV.find(function (n) { return n[0] === r; });
  return f ? f[1] : '';
}

var routes = {};
function route() {
  var name = (location.hash || '').replace(/^#\/?/, '').split('/')[0] || 'dashboard';
  if (state.needsSetup && !state.user) { renderSetup(); return; }
  if (!state.user) { renderLogin(); return; }
  if (!routes[name]) { location.hash = '#/dashboard'; return; }
  var need = (NAV.find(function (n) { return n[0] === name; }) || [])[2];
  if (need && state.user.role !== need) { location.hash = '#/dashboard'; return; }
  state.route = name;
  renderShell();
  safe($('#page'), function () { return routes[name]($('#page')); });
}

async function boot(retry) {
  if (retry) $app.innerHTML = '<div class="maintenance"><div class="box"><p>লোড হচ্ছে...</p></div></div>';
  try {
    var st = await api.get('/api/auth-status');
    state.needsSetup = !!st.needsSetup;
    if (st.user && st.user.portal === 'pharmacy') state.user = st.user;
    else { state.user = null; api.token = null; }
    if (st.softwareOnline === false && state.user) {
      // logged in but software turned OFF meanwhile
      api.token = null; state.user = null;
      showMaintenance(st.maintenanceMessage);
      return;
    }
  } catch (e) {
    if (String(e.message).indexOf('__') === 0) return;
    $app.innerHTML = '<div class="maintenance"><div class="box"><div class="error">' +
      esc(e.message) + '</div><button class="btn" onclick="location.reload()">আবার চেষ্টা করুন</button></div></div>';
    return;
  }
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

routes.dashboard = async function (el) {
  el.innerHTML = '<p>লোড হচ্ছে...</p>';
  var d = await api.get('/api/dashboard');
  state.settings = d.settings || {};
  var s = d.stats;
  var html = '<div class="cards">' +
    statCard('মোট ওষুধ', num(s.medicineCount), '') +
    statCard('মোট ইউনিট', num(s.totalUnits), '') +
    statCard('স্টক মূল্য', fmt(s.stockValue), '') +
    statCard('আজকের বিক্রি', fmt(s.todaySales), '') +
    statCard('আজকের লেনদেন', num(s.todayTransactions), '') +
    statCard('মোট বকেয়া', fmt(s.totalDue), s.totalDue > 0 ? 'danger' : '') +
    statCard('লো স্টক', num(s.lowStockCount), s.lowStockCount > 0 ? 'warn' : '') +
    statCard('মেয়াদ আসন্ন', num(s.expiringCount), s.expiringCount > 0 ? 'warn' : '') +
    '</div>';
  html += '<div class="grid2">';
  html += '<div class="card"><h3>⚠️ লো স্টক</h3>' + alertList(d.alerts.lowStock.map(function (m) {
    return '<span class="badge amber">' + num(m.stock) + ' ' + esc(m.unit) + '</span> ' + esc(m.name);
  }), 'সব ঠিক আছে।') + '</div>';
  html += '<div class="card"><h3>⏳ মেয়াদ আসন্ন (৬০ দিন)</h3>' + alertList(d.alerts.expiring.map(function (m) {
    return esc(m.expiry_date) + ' — ' + esc(m.name);
  }), 'সব ঠিক আছে।') + '</div></div>';
  html += '<div class="card" style="margin-top:12px"><h3>সাম্প্রতিক বিক্রি</h3>' + miniSalesTable(d.recentSales) + '</div>';
  el.innerHTML = html;
  renderShellBrand();
};
function statCard(lbl, val, cls) {
  return '<div class="card stat ' + cls + '"><div class="num">' + val + '</div><div class="lbl">' + lbl + '</div></div>';
}
function alertList(items, emptyText) {
  if (!items.length) return '<p style="color:var(--muted)">' + emptyText + '</p>';
  return '<ul style="margin:0;padding-left:18px">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
}
function miniSalesTable(rows) {
  if (!rows.length) return '<p style="color:var(--muted)">এখনো বিক্রি হয়নি।</p>';
  return '<div class="table-wrap"><table><tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>মোট</th><th>বকেয়া</th><th>তারিখ</th></tr>' +
    rows.map(function (r) {
      return '<tr><td>' + esc(r.invoice_no) + '</td><td>' + esc(r.customer_name || '-') + '</td><td>' + fmt(r.total) +
        '</td><td>' + (r.due > 0 ? '<span class="badge red">' + fmt(r.due) + '</span>' : '-') + '</td><td>' + esc(r.date) + '</td></tr>';
    }).join('') + '</table></div>';
}
function renderShellBrand() {
  var b = document.querySelector('.sidebar .brand');
  if (b && state.settings.pharmacy_name) b.textContent = '💊 ' + state.settings.pharmacy_name;
}

// ---- Medicines ----
routes.medicines = async function (el) {
  el.innerHTML =
    '<div class="toolbar"><input type="search" id="med-q" placeholder="🔍 ওষুধ খুঁজুন...">' +
    '<label><input type="checkbox" id="med-low"> লো স্টক</label>' +
    '<label><input type="checkbox" id="med-exp"> মেয়াদ আসন্ন</label>' +
    '<button class="btn" id="med-add">+ নতুন ওষুধ</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>নাম</th><th>জেনেরিক</th><th>কোম্পানি</th><th>ক্রয়</th><th>বিক্রয়</th>' +
    '<th>স্টক</th><th>মেয়াদ</th><th></th></tr></thead><tbody id="med-rows"></tbody></table></div>';
  var load = async function () {
    var q = $('#med-q').value.trim();
    var p = '/api/medicines?' + new URLSearchParams({
      q: q, lowstock: $('#med-low').checked ? '1' : '', expiring: $('#med-exp').checked ? '1' : ''
    }).toString();
    var d = await api.get(p);
    $('#med-rows').innerHTML = d.medicines.map(function (m) {
      var stockBadge = m.stock <= m.reorder_level
        ? '<span class="badge amber">' + num(m.stock) + ' ' + esc(m.unit) + '</span>'
        : num(m.stock) + ' ' + esc(m.unit);
      return '<tr><td><strong>' + esc(m.name) + '</strong>' + (m.sku ? '<br><small>' + esc(m.sku) + '</small>' : '') + '</td>' +
        '<td>' + esc(m.generic_name) + '</td><td>' + esc(m.manufacturer) + '</td>' +
        '<td>' + fmt(m.purchase_price) + '</td><td>' + fmt(m.sale_price) + '</td>' +
        '<td>' + stockBadge + '</td><td>' + esc(m.expiry_date || '-') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn small ghost" data-edit="' + m.id + '">এডিট</button> ' +
        (state.user.role === 'master_admin' ? '<button class="btn small danger" data-del="' + m.id + '">মুছুন</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">কোনো ওষুধ পাওয়া যায়নি।</td></tr>';
    bindMedButtons();
  };
  var deb;
  $('#med-q').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(load, 300); });
  $('#med-low').addEventListener('change', load);
  $('#med-exp').addEventListener('change', load);
  $('#med-add').addEventListener('click', function () { medForm(null, load); });
  await load();

  function bindMedButtons() {
    document.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var d = await api.get('/api/medicines?q=');
        var m = d.medicines.find(function (x) { return x.id == b.dataset.edit; });
        medForm(m, load);
      });
    });
    document.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('এই ওষুধটি মুছে ফেলবেন?')) return;
        try { await api.del('/api/medicines/' + b.dataset.del); load(); }
        catch (e) { if (String(e.message).indexOf('__') !== 0) alert(e.message); }
      });
    });
  }
};

async function medForm(m, onDone) {
  m = m || {};
  var sups = await api.get('/api/suppliers');
  var opts = '<option value="">— নেই —</option>' + sups.suppliers.map(function (s) {
    return '<option value="' + s.id + '"' + (m.supplier_id == s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  }).join('');
  openModal(m.id ? 'ওষুধ এডিট' : 'নতুন ওষুধ',
    '<div class="form-grid">' +
    input('name', 'নাম *', { required: true, value: m.name, full: true }) +
    input('generic_name', 'জেনেরিক নাম', { value: m.generic_name }) +
    input('manufacturer', 'কোম্পানি', { value: m.manufacturer }) +
    input('unit', 'একক', { value: m.unit || 'পিস' }) +
    input('sku', 'SKU/কোড', { value: m.sku }) +
    input('purchase_price', 'ক্রয়মূল্য (৳)', { type: 'number', min: 0, value: m.purchase_price || 0 }) +
    input('sale_price', 'বিক্রয়মূল্য (৳)', { type: 'number', min: 0, value: m.sale_price || 0 }) +
    input('stock', 'স্টক', { type: 'number', min: 0, value: m.stock || 0 }) +
    input('reorder_level', 'রি-অর্ডার লেভেল', { type: 'number', min: 0, value: m.reorder_level || 0 }) +
    input('expiry_date', 'মেয়াদ (YYYY-MM-DD)', { value: m.expiry_date || '' }) +
    '<div class="field full"><label>সাপ্লায়ার</label><select name="supplier_id">' + opts + '</select></div>' +
    '</div>',
    async function (data) {
      var payload = {
        name: data.name, generic_name: data.generic_name, manufacturer: data.manufacturer,
        unit: data.unit, sku: data.sku,
        purchase_price: parseInt(data.purchase_price, 10) || 0,
        sale_price: parseInt(data.sale_price, 10) || 0,
        stock: parseInt(data.stock, 10) || 0,
        reorder_level: parseInt(data.reorder_level, 10) || 0,
        expiry_date: (data.expiry_date || '').trim(),
        supplier_id: data.supplier_id ? parseInt(data.supplier_id, 10) : null
      };
      if (m.id) await api.put('/api/medicines/' + m.id, payload);
      else await api.post('/api/medicines', payload);
      onDone();
    });
}

// ---- POS ----
var posCart = [];
routes.pos = async function (el) {
  el.innerHTML =
    '<div class="pos-grid"><div class="card"><h3>🔍 ওষুধ খুঁজুন</h3>' +
    '<input type="search" id="pos-q" placeholder="নাম লিখুন..." style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-family:inherit">' +
    '<div id="pos-results" style="margin-top:10px"></div></div>' +
    '<div class="card"><h3>🧾 বিল</h3><div id="pos-cart"></div>' +
    '<div class="form-grid" style="margin-top:10px">' +
    input('cust_name', 'কাস্টমারের নাম', { full: true }) +
    input('cust_phone', 'ফোন', {}) +
    input('discount', 'ছাড় (৳)', { type: 'number', min: 0, value: 0 }) +
    input('paid', 'পরিশোধ (৳)', { type: 'number', min: 0, value: 0 }) +
    '</div><button class="btn block" id="pos-submit" style="margin-top:12px">বিক্রি সম্পন্ন করুন</button>' +
    '</div></div><div id="print-area"></div>';
  renderCart();
  var deb;
  $('#pos-q').addEventListener('input', function () {
    clearTimeout(deb);
    deb = setTimeout(async function () {
      var q = $('#pos-q').value.trim();
      if (q.length < 2) { $('#pos-results').innerHTML = ''; return; }
      try {
        var d = await api.get('/api/medicines?' + new URLSearchParams({ q: q }).toString());
        $('#pos-results').innerHTML = d.medicines.slice(0, 12).map(function (m) {
          return '<div class="result-item"><div><strong>' + esc(m.name) + '</strong><br><small>' +
            fmt(m.sale_price) + ' • স্টক: ' + num(m.stock) + '</small></div>' +
            '<button class="btn small" data-add="' + m.id + '"' + (m.stock <= 0 ? ' disabled' : '') + '>যোগ</button></div>';
        }).join('') || '<p style="color:var(--muted)">পাওয়া যায়নি।</p>';
        document.querySelectorAll('[data-add]').forEach(function (b) {
          b.addEventListener('click', function () {
            var m = d.medicines.find(function (x) { return x.id == b.dataset.add; });
            addToCart(m);
          });
        });
      } catch (e) { if (String(e.message).indexOf('__') !== 0) $('#pos-results').innerHTML = '<div class="error">' + esc(e.message) + '</div>'; }
    }, 300);
  });
  $('#pos-submit').addEventListener('click', submitSale);

  function addToCart(m) {
    var line = posCart.find(function (l) { return l.id === m.id; });
    if (line) {
      if (line.qty + 1 > m.stock) { alert('স্টক পর্যাপ্ত নয়।'); return; }
      line.qty++;
    } else {
      posCart.push({ id: m.id, name: m.name, sale_price: m.sale_price, stock: m.stock, qty: 1 });
    }
    renderCart();
  }
  function renderCart() {
    var box = $('#pos-cart');
    if (!posCart.length) { box.innerHTML = '<p style="color:var(--muted)">কার্ট খালি।</p>'; return; }
    var sub = 0;
    var rows = posCart.map(function (l, i) {
      sub += l.qty * l.sale_price;
      return '<div class="result-item"><div><strong>' + esc(l.name) + '</strong><br><small>' + fmt(l.sale_price) + '</small></div>' +
        '<div class="qty-ctrl"><button data-dec="' + i + '">−</button> <strong>' + num(l.qty) + '</strong> ' +
        '<button data-inc="' + i + '">+</button> <button class="btn small ghost" data-rm="' + i + '">✕</button></div></div>';
    }).join('');
    box.innerHTML = rows + '<div class="totals"><div class="row grand"><span>মোট:</span><span>' + fmt(sub) + '</span></div></div>';
    box.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = posCart[+b.dataset.inc];
        if (l.qty + 1 > l.stock) { alert('স্টক পর্যাপ্ত নয়।'); return; }
        l.qty++; renderCart();
      });
    });
    box.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var l = posCart[+b.dataset.dec];
        l.qty--; if (l.qty <= 0) posCart.splice(+b.dataset.dec, 1);
        renderCart();
      });
    });
    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () { posCart.splice(+b.dataset.rm, 1); renderCart(); });
    });
  }
  async function submitSale() {
    if (!posCart.length) { alert('কার্ট খালি।'); return; }
    var custName = $('input[name="cust_name"]').value.trim();
    var custPhone = $('input[name="cust_phone"]').value.trim();
    var discount = parseInt($('input[name="discount"]').value, 10) || 0;
    var paid = parseInt($('input[name="paid"]').value, 10) || 0;
    try {
      var d = await api.post('/api/sales', {
        customer_name: custName, customer_phone: custPhone,
        items: posCart.map(function (l) { return { medicine_id: l.id, qty: l.qty }; }),
        discount: discount, paid: paid
      });
      posCart = [];
      renderCart();
      showInvoice(d.id);
    } catch (e) { if (String(e.message).indexOf('__') !== 0) alert(e.message); }
  }
  async function showInvoice(saleId) {
    var d = await api.get('/api/sales/' + saleId);
    var s = d.sale, st = d.settings || {};
    var rows = d.items.map(function (it, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(it.medicine_name) + '</td><td>' + num(it.qty) + '</td>' +
        '<td>' + fmt(it.price) + '</td><td>' + fmt(it.qty * it.price) + '</td></tr>';
    }).join('');
    $('#print-area').innerHTML =
      '<div class="card no-print" style="margin-top:14px"><div class="invoice" id="invoice-doc">' +
      '<h2>' + esc(st.pharmacy_name || 'ফার্মেসি') + '</h2>' +
      '<div class="meta">' + esc(st.pharmacy_address || '') + (st.pharmacy_phone ? ' • ' + esc(st.pharmacy_phone) : '') + '</div>' +
      '<p><strong>ইনভয়েস:</strong> ' + esc(s.invoice_no) + '<br><strong>তারিখ:</strong> ' + esc(s.date) +
      '<br><strong>কাস্টমার:</strong> ' + esc(s.customer_name || '-') + (s.customer_phone ? ' (' + esc(s.customer_phone) + ')' : '') + '</p>' +
      '<div class="table-wrap"><table><tr><th>#</th><th>ওষুধ</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr>' + rows + '</table></div>' +
      '<div class="totals" style="margin-top:10px"><div class="row"><span>ছাড়:</span><span>' + fmt(s.discount) + '</span></div>' +
      '<div class="row grand"><span>সর্বমোট:</span><span>' + fmt(s.total) + '</span></div>' +
      '<div class="row"><span>পরিশোধ:</span><span>' + fmt(s.paid) + '</span></div>' +
      '<div class="row"><span>বকেয়া:</span><span>' + fmt(s.due) + '</span></div></div>' +
      '<p style="text-align:center;color:var(--muted)">' + esc(st.invoice_footer || '') + '</p>' +
      '</div><div style="text-align:center;margin-top:10px"><button class="btn" onclick="window.print()">🖨️ প্রিন্ট</button></div></div>';
    $('#print-area').scrollIntoView();
  }
};

// ---- Purchases ----
routes.purchases = async function (el) {
  el.innerHTML =
    '<div class="toolbar"><button class="btn" id="pur-new">+ নতুন ক্রয়</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>তারিখ</th><th>সাপ্লায়ার</th><th>ইনভয়েস</th>' +
    '<th>মোট</th><th>পরিশোধ</th><th>বকেয়া</th></tr></thead><tbody id="pur-rows"></tbody></table></div>';
  var load = async function () {
    var d = await api.get('/api/purchases');
    $('#pur-rows').innerHTML = d.purchases.map(function (p) {
      return '<tr><td>' + esc(p.date) + '</td><td>' + esc(p.supplier_name) + '</td><td>' + esc(p.invoice_no || '-') +
        '</td><td>' + fmt(p.total) + '</td><td>' + fmt(p.paid) + '</td><td>' +
        (p.due > 0 ? '<span class="badge red">' + fmt(p.due) + '</span>' : '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">কোনো ক্রয় নেই।</td></tr>';
  };
  $('#pur-new').addEventListener('click', function () { purchaseForm(load); });
  await load();
};

async function purchaseForm(onDone) {
  var sups = await api.get('/api/suppliers');
  var meds = await api.get('/api/medicines');
  if (!meds.medicines.length) { alert('আগে ওষুধ যোগ করুন।'); return; }
  var supOpts = sups.suppliers.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
  var medOpts = meds.medicines.map(function (m) {
    return '<option value="' + m.id + '">' + esc(m.name) + ' (' + fmt(m.purchase_price) + ')</option>';
  }).join('');
  var rowHtml = function () {
    return '<div class="result-item pur-row"><select name="mid" style="flex:1">' + medOpts + '</select> ' +
      '<input name="qty" type="number" min="1" value="1" style="width:70px"> ' +
      '<input name="price" type="number" min="0" value="0" style="width:90px" placeholder="দাম"> ' +
      '<button type="button" class="btn small ghost pur-rm">✕</button></div>';
  };
  openModal('নতুন ক্রয়',
    '<div class="form-grid">' +
    '<div class="field"><label>সাপ্লায়ার</label><select name="supplier_id"><option value="">— নেই —</option>' + supOpts + '</select></div>' +
    input('invoice_no', 'ইনভয়েস নং', {}) +
    input('date', 'তারিখ', { type: 'date', value: new Date().toISOString().slice(0, 10) }) +
    input('paid', 'পরিশোধ (৳)', { type: 'number', min: 0, value: 0 }) +
    '</div><h4>আইটেম</h4><div id="pur-items">' + rowHtml() + '</div>' +
    '<button type="button" class="btn ghost small" id="pur-addrow" style="margin-top:8px">+ আইটেম যোগ</button>',
    async function (data, form) {
      var rows = Array.prototype.slice.call(form.querySelectorAll('.pur-row'));
      var items = rows.map(function (r) {
        return {
          medicine_id: parseInt(r.querySelector('[name="mid"]').value, 10),
          qty: parseInt(r.querySelector('[name="qty"]').value, 10) || 0,
          price: parseInt(r.querySelector('[name="price"]').value, 10) || 0
        };
      }).filter(function (it) { return it.qty > 0; });
      if (!items.length) throw new Error('কমপক্ষে একটি আইটেম দিন।');
      await api.post('/api/purchases', {
        supplier_id: data.supplier_id ? parseInt(data.supplier_id, 10) : null,
        invoice_no: data.invoice_no, date: data.date,
        paid: parseInt(data.paid, 10) || 0, items: items
      });
      onDone();
    });
  $('#pur-addrow').addEventListener('click', function () {
    $('#pur-items').insertAdjacentHTML('beforeend', rowHtml());
    bindRm();
  });
  bindRm();
  function bindRm() {
    document.querySelectorAll('.pur-rm').forEach(function (b) {
      b.onclick = function () { b.closest('.pur-row').remove(); };
    });
  }
}

// ---- Suppliers ----
routes.suppliers = async function (el) {
  el.innerHTML =
    '<div class="toolbar"><button class="btn" id="sup-add">+ নতুন সাপ্লায়ার</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>নাম</th><th>ফোন</th><th>ঠিকানা</th><th></th></tr></thead>' +
    '<tbody id="sup-rows"></tbody></table></div>';
  var load = async function () {
    var d = await api.get('/api/suppliers');
    $('#sup-rows').innerHTML = d.suppliers.map(function (s) {
      return '<tr><td><strong>' + esc(s.name) + '</strong></td><td>' + esc(s.phone) + '</td><td>' + esc(s.address) + '</td>' +
        '<td style="white-space:nowrap"><button class="btn small ghost" data-sedit="' + s.id + '">এডিট</button> ' +
        (state.user.role === 'master_admin' ? '<button class="btn small danger" data-sdel="' + s.id + '">মুছুন</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">কোনো সাপ্লায়ার নেই।</td></tr>';
    document.querySelectorAll('[data-sedit]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var all = await api.get('/api/suppliers');
        var s = all.suppliers.find(function (x) { return x.id == b.dataset.sedit; });
        supForm(s, load);
      });
    });
    document.querySelectorAll('[data-sdel]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('এই সাপ্লায়ার মুছে ফেলবেন?')) return;
        await api.del('/api/suppliers/' + b.dataset.sdel);
        load();
      });
    });
  };
  $('#sup-add').addEventListener('click', function () { supForm(null, load); });
  await load();
};

function supForm(s, onDone) {
  s = s || {};
  openModal(s.id ? 'সাপ্লায়ার এডিট' : 'নতুন সাপ্লায়ার',
    '<div class="form-grid">' +
    input('name', 'নাম *', { required: true, value: s.name, full: true }) +
    input('phone', 'ফোন', { value: s.phone }) +
    input('address', 'ঠিকানা', { value: s.address, full: true }) +
    '</div>',
    async function (data) {
      if (s.id) await api.put('/api/suppliers/' + s.id, data);
      else await api.post('/api/suppliers', data);
      onDone();
    });
}

// ---- Dues ----
routes.dues = async function (el) {
  el.innerHTML = '<div id="dues-box"><p>লোড হচ্ছে...</p></div>';
  var load = async function () {
    var d = await api.get('/api/dues');
    var sRows = d.sales.map(function (r) {
      return '<tr><td>' + esc(r.invoice_no) + '</td><td>' + esc(r.customer_name || '-') + '</td><td>' + esc(r.date) +
        '</td><td>' + fmt(r.total) + '</td><td><span class="badge red">' + fmt(r.due) + '</span></td>' +
        '<td><button class="btn small" data-ctype="sale" data-cid="' + r.id + '" data-cdue="' + r.due + '">টাকা নিন</button></td></tr>';
    }).join('');
    var pRows = d.purchases.map(function (r) {
      return '<tr><td>' + esc(r.invoice_no || '-') + '</td><td>' + esc(r.supplier_name) + '</td><td>' + esc(r.date) +
        '</td><td>' + fmt(r.total) + '</td><td><span class="badge red">' + fmt(r.due) + '</span></td>' +
        '<td><button class="btn small" data-ctype="purchase" data-cid="' + r.id + '" data-cdue="' + r.due + '">পরিশোধ</button></td></tr>';
    }).join('');
    $('#dues-box').innerHTML =
      '<div class="card" style="margin-bottom:12px"><h3>🧍 কাস্টমার বকেয়া</h3><div class="table-wrap"><table>' +
      '<tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>মোট</th><th>বকেয়া</th><th></th></tr>' +
      (sRows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">কোনো বকেয়া নেই।</td></tr>') + '</table></div></div>' +
      '<div class="card"><h3>🏭 সাপ্লায়ার বকেয়া</h3><div class="table-wrap"><table>' +
      '<tr><th>ইনভয়েস</th><th>সাপ্লায়ার</th><th>তারিখ</th><th>মোট</th><th>বকেয়া</th><th></th></tr>' +
      (pRows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">কোনো বকেয়া নেই।</td></tr>') + '</table></div></div>';
    document.querySelectorAll('[data-ctype]').forEach(function (b) {
      b.addEventListener('click', function () { collectDue(b.dataset.ctype, b.dataset.cid, b.dataset.cdue, load); });
    });
  };
  await load();
};

function collectDue(type, id, due, onDone) {
  openModal(type === 'sale' ? 'টাকা আদায়' : 'বকেয়া পরিশোধ',
    '<p>বকেয়া: <strong>' + fmt(due) + '</strong></p>' + input('amount', 'পরিমাণ (৳)', { type: 'number', min: 1, value: due, full: true, required: true }),
    async function (data) {
      await api.post('/api/dues/collect', { type: type, id: parseInt(id, 10), amount: parseInt(data.amount, 10) || 0 });
      onDone();
    });
}

// ---- Reports ----
routes.reports = async function (el) {
  var today = new Date().toISOString().slice(0, 10);
  var first = today.slice(0, 8) + '01';
  el.innerHTML =
    '<div class="card" style="margin-bottom:12px"><h3>📈 বিক্রি রিপোর্ট</h3>' +
    '<div class="toolbar"><input type="date" id="rep-from" value="' + first + '"><input type="date" id="rep-to" value="' + today + '">' +
    '<button class="btn" id="rep-go">দেখুন</button></div><div id="rep-out"></div></div>' +
    '<div class="card"><h3>📦 স্টক রিপোর্ট</h3><button class="btn" id="stock-go">স্টক রিপোর্ট দেখুন</button><div id="stock-out" style="margin-top:10px"></div></div>';
  $('#rep-go').addEventListener('click', async function () {
    var out = $('#rep-out');
    out.innerHTML = '<p>লোড হচ্ছে...</p>';
    try {
      var d = await api.get('/api/reports/sales?' + new URLSearchParams({ from: $('#rep-from').value, to: $('#rep-to').value }).toString());
      var t = d.totals;
      out.innerHTML =
        '<div class="cards">' + statCard('লেনদেন', num(t.count), '') + statCard('মোট বিক্রি', fmt(t.total), '') +
        statCard('ছাড়', fmt(t.discount), '') + statCard('আদায়', fmt(t.paid), '') + statCard('বকেয়া', fmt(t.due), t.due > 0 ? 'danger' : '') + '</div>' +
        '<div class="table-wrap"><table><tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>মোট</th><th>ছাড়</th><th>পরিশোধ</th><th>বকেয়া</th></tr>' +
        d.sales.map(function (r) {
          return '<tr><td>' + esc(r.invoice_no) + '</td><td>' + esc(r.customer_name || '-') + '</td><td>' + esc(r.date) +
            '</td><td>' + fmt(r.total) + '</td><td>' + fmt(r.discount) + '</td><td>' + fmt(r.paid) + '</td><td>' + fmt(r.due) + '</td></tr>';
        }).join('') + '</table></div>';
    } catch (e) { if (String(e.message).indexOf('__') !== 0) out.innerHTML = '<div class="error">' + esc(e.message) + '</div>'; }
  });
  $('#stock-go').addEventListener('click', async function () {
    var out = $('#stock-out');
    out.innerHTML = '<p>লোড হচ্ছে...</p>';
    try {
      var d = await api.get('/api/reports/stock');
      out.innerHTML = '<p><strong>মোট স্টক মূল্য:</strong> ' + fmt(d.totalValue) + '</p>' +
        '<div class="table-wrap"><table><tr><th>ওষুধ</th><th>স্টক</th><th>বিক্রয়মূল্য</th><th>মূল্য</th></tr>' +
        d.medicines.map(function (m) {
          return '<tr><td>' + esc(m.name) + '</td><td>' + num(m.stock) + ' ' + esc(m.unit) + '</td><td>' + fmt(m.sale_price) +
            '</td><td>' + fmt(m.stock_value) + '</td></tr>';
        }).join('') + '</table></div>';
    } catch (e) { if (String(e.message).indexOf('__') !== 0) out.innerHTML = '<div class="error">' + esc(e.message) + '</div>'; }
  });
};

// ---- Users (master_admin) ----
routes.users = async function (el) {
  el.innerHTML =
    '<div class="toolbar"><button class="btn" id="usr-add">+ নতুন ইউজার</button></div>' +
    '<div class="table-wrap"><table><thead><tr><th>নাম</th><th>ইউজারনেম</th><th>রোল</th><th>অবস্থা</th><th></th></tr></thead>' +
    '<tbody id="usr-rows"></tbody></table></div>';
  var load = async function () {
    var d = await api.get('/api/users');
    $('#usr-rows').innerHTML = d.users.map(function (u) {
      return '<tr><td>' + esc(u.full_name) + '</td><td>' + esc(u.username) + '</td><td>' + roleName(u.role) + '</td>' +
        '<td>' + (u.active ? '<span class="badge green">সক্রিয়</span>' : '<span class="badge grey">নিষ্ক্রিয়</span>') + '</td>' +
        '<td><button class="btn small ghost" data-ustatus="' + u.id + '" data-uactive="' + u.active + '">' +
        (u.active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন') + '</button></td></tr>';
    }).join('');
    document.querySelectorAll('[data-ustatus]').forEach(function (b) {
      b.addEventListener('click', async function () {
        try {
          await api.put('/api/users/' + b.dataset.ustatus + '/status', { active: b.dataset.uactive === '1' ? 0 : 1 });
          load();
        } catch (e) { if (String(e.message).indexOf('__') !== 0) alert(e.message); }
      });
    });
  };
  $('#usr-add').addEventListener('click', function () {
    openModal('নতুন ইউজার',
      '<div class="form-grid">' +
      input('fullName', 'নাম *', { required: true, full: true }) +
      input('username', 'ইউজারনেম *', { required: true }) +
      input('password', 'পাসওয়ার্ড *', { type: 'password', required: true }) +
      '<div class="field full"><label>রোল</label><select name="role"><option value="staff">স্টাফ</option><option value="master_admin">মাস্টার অ্যাডমিন</option></select></div>' +
      '</div>',
      async function (data) {
        await api.post('/api/users', data);
        load();
      });
  });
  await load();
};

// ---- Settings (master_admin) ----
routes.settings = async function (el) {
  el.innerHTML = '<p>লোড হচ্ছে...</p>';
  var d = await api.get('/api/settings');
  var s = d.settings;
  el.innerHTML =
    '<div class="card"><h3>⚙️ ফার্মেসি সেটিংস</h3><div class="error form-error" style="display:none"></div>' +
    '<form id="settings-form"><div class="form-grid">' +
    input('pharmacy_name', 'ফার্মেসির নাম', { value: s.pharmacy_name, full: true }) +
    input('pharmacy_phone', 'ফোন', { value: s.pharmacy_phone }) +
    input('pharmacy_address', 'ঠিকানা', { value: s.pharmacy_address, full: true }) +
    '<div class="field full"><label>ইনভয়েস ফুটার বার্তা</label><textarea name="invoice_footer">' + esc(s.invoice_footer) + '</textarea></div>' +
    '</div><button class="btn" type="submit">সংরক্ষণ</button></form></div>';
  $('#settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    try {
      var r = await api.put('/api/settings', {
        pharmacy_name: fd.get('pharmacy_name'), pharmacy_phone: fd.get('pharmacy_phone'),
        pharmacy_address: fd.get('pharmacy_address'), invoice_footer: fd.get('invoice_footer')
      });
      state.settings = r.settings;
      renderShellBrand();
      fieldError(el, '');
      alert('সংরক্ষণ হয়েছে।');
    } catch (err2) { if (String(err2.message).indexOf('__') !== 0) fieldError(el, err2.message); }
  });
};

// ---------------------------------------------------------------------------
boot(false);
})();
