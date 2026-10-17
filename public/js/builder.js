/* builder.js — Super Admin (software builder) portal. Separate page + separate login. */
(function () {
'use strict';

var $app = document.getElementById('app');
var TOKEN_KEY = 'fm_builder_token';

var api = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  set token(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  },
  async call(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    var res = await fetch(path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    var data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (res.status === 401) { this.token = null; renderLogin(); throw new Error('__auth__'); }
    if (!res.ok) throw new Error((data && data.error) || 'একটি সমস্যা হয়েছে।');
    return data;
  },
  get: function (p) { return this.call('GET', p); },
  post: function (p, b) { return this.call('POST', p, b); },
  put: function (p, b) { return this.call('PUT', p, b); }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function showErr(msg) {
  var box = document.querySelector('.form-error');
  if (box) { box.textContent = msg; box.style.display = 'block'; }
}

// First-run builder setup form
function renderSetup() {
  $app.innerHTML =
    '<div class="auth-wrap"><div class="auth-card">' +
    '<h1>🔧 নির্মাতা পোর্টাল</h1><p class="sub">সফটওয়্যার নির্মাতার সুপার অ্যাডমিন সেটআপ (একবারের জন্য)</p>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<form id="bsetup-form">' +
    '<div class="field"><label>আপনার নাম</label><input name="fullName" required></div>' +
    '<div class="field"><label>বিল্ডার আইডি (ইউজারনেম)</label><input name="builderId" required autocomplete="username"></div>' +
    '<div class="field"><label>পাসওয়ার্ড</label><input name="password" type="password" required autocomplete="new-password"></div>' +
    '<button class="btn block" type="submit">সেটআপ সম্পন্ন করুন</button></form>' +
    '<div class="builder-link"><a href="index.html">← ফার্মেসি পোর্টালে ফিরুন</a></div>' +
    '</div></div>';
  document.getElementById('bsetup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    try {
      var d = await api.post('/api/setup-builder', {
        fullName: fd.get('fullName'), builderId: fd.get('builderId'), password: fd.get('password')
      });
      api.token = d.token;
      renderPanel();
    } catch (err) { if (err.message !== '__auth__') showErr(err.message); }
  });
}

// Builder login form
function renderLogin() {
  $app.innerHTML =
    '<div class="auth-wrap"><div class="auth-card">' +
    '<h1>🔧 নির্মাতা লগইন</h1><p class="sub">শুধু সফটওয়্যার নির্মাতার জন্য</p>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<form id="blogin-form">' +
    '<div class="field"><label>বিল্ডার আইডি</label><input name="username" required autocomplete="username"></div>' +
    '<div class="field"><label>পাসওয়ার্ড</label><input name="password" type="password" required autocomplete="current-password"></div>' +
    '<button class="btn block" type="submit">লগইন</button></form>' +
    '<div class="builder-link"><a href="index.html">← ফার্মেসি পোর্টালে ফিরুন</a></div>' +
    '</div></div>';
  document.getElementById('blogin-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    try {
      var d = await api.post('/api/login', {
        username: fd.get('username'), password: fd.get('password'), portal: 'builder'
      });
      api.token = d.token;
      renderPanel();
    } catch (err) { if (err.message !== '__auth__') showErr(err.message); }
  });
}

// Builder control panel: ON/OFF toggle + maintenance message
async function renderPanel() {
  $app.innerHTML = '<div class="auth-wrap"><div class="auth-card"><p style="text-align:center">লোড হচ্ছে...</p></div></div>';
  try {
    var st = await api.get('/api/builder/status');
  } catch (e) {
    if (e.message !== '__auth__') {
      $app.innerHTML = '<div class="auth-wrap"><div class="auth-card"><div class="error">' + esc(e.message) + '</div></div></div>';
    }
    return;
  }
  var online = !!st.online;
  $app.innerHTML =
    '<div class="auth-wrap"><div class="auth-card">' +
    '<h1>🔧 নির্মাতা প্যানেল</h1>' +
    '<div class="big-panel">' +
    '<p><span class="status-dot ' + (online ? 'on' : 'off') + '"></span>' +
    '<strong>সফটওয়্যার: ' + (online ? 'চালু আছে' : 'বন্ধ আছে') + '</strong></p>' +
    '<label class="switch"><input type="checkbox" id="online-toggle"' + (online ? ' checked' : '') + '><span class="slider"></span></label>' +
    '<p style="color:var(--muted);font-size:13px">বন্ধ থাকলে ফার্মেসি পোর্টালের সবাই রক্ষণাবেক্ষণ পেজ দেখবে।</p>' +
    '</div>' +
    '<div class="error form-error" style="display:none"></div>' +
    '<div class="field"><label>রক্ষণাবেক্ষণ বার্তা</label><textarea id="maint-msg">' + esc(st.maintenanceMessage) + '</textarea></div>' +
    '<button class="btn block" id="maint-save">বার্তা সংরক্ষণ</button>' +
    '<div style="display:flex;gap:10px;margin-top:14px">' +
    '<a class="btn ghost block" href="index.html" style="text-align:center;text-decoration:none">মূল প্যানেলে ফিরুন</a>' +
    '<button class="btn danger block" id="blogout">লগআউট</button></div>' +
    '</div></div>';

  document.getElementById('online-toggle').addEventListener('change', async function (e) {
    try {
      var r = await api.post('/api/builder/toggle', { online: e.target.checked });
      renderPanel();
    } catch (err) {
      if (err.message !== '__auth__') { showErr(err.message); e.target.checked = !e.target.checked; }
    }
  });
  document.getElementById('maint-save').addEventListener('click', async function () {
    try {
      await api.put('/api/builder/maintenance-message', { message: document.getElementById('maint-msg').value });
      alert('সংরক্ষণ হয়েছে।');
    } catch (err) { if (err.message !== '__auth__') showErr(err.message); }
  });
  document.getElementById('blogout').addEventListener('click', async function () {
    try { await api.post('/api/logout'); } catch (e) { /* ignore */ }
    api.token = null;
    renderLogin();
  });
}

async function boot() {
  try {
    var st = await api.get('/api/auth-status');
    if (st.needsBuilderSetup) { renderSetup(); return; }
    // Try to resume session if a builder token exists
    if (api.token && st.user && st.user.role === 'super_admin' && st.user.portal === 'builder') {
      renderPanel();
    } else {
      api.token = null;
      renderLogin();
    }
  } catch (e) {
    $app.innerHTML = '<div class="auth-wrap"><div class="auth-card"><div class="error">সার্ভারের সাথে সংযোগ করা যাচ্ছে না।</div></div></div>';
  }
}

boot();
})();
