import React, { useState } from 'react';
import { getSettings, roleName } from '../lib/store.js';

/* Session-storage flag: builder portal sets this to '1' then routes to #/dashboard
 * so the pharmacy main panel opens "as the builder" (bypasses maintenance gate). */
export const BUILDER_ENTER_KEY = 'farmacy_react_builder_enter';

/* [route, label, requiredRole?] — routes with a required role are hidden from
 * other roles' nav and guarded in App.jsx. */
export const NAV = [
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

export default function Layout({ user, route, onLogout, isBuilderMode, children }) {
  const [open, setOpen] = useState(false);
  const settings = getSettings();
  const entry = NAV.find(([r]) => r === route);
  const title = entry ? entry[1] : '';

  const links = NAV.filter(([, , req]) => !req || user.role === req || isBuilderMode);

  return (
    <div className="shell">
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">💊 {settings.pharmacy_name || 'ফার্মেসি'}</div>
        <div className="who">
          {user.full_name} ({roleName(user.role)})
        </div>
        <nav className="nav">
          {links.map(([r, label]) => (
            <a
              key={r}
              href={'#/' + r}
              className={r === route ? 'active' : ''}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="btn ghost small menu-btn" onClick={() => setOpen((o) => !o)}>
            ☰ মেনু
          </button>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost small" onClick={onLogout}>
            লগআউট
          </button>
        </div>

        {isBuilderMode && (
          <div className="builder-banner">
            🔧 নির্মাতা হিসেবে মূল প্যানেলে প্রবেশ করেছেন{' '}
            <button
              className="btn small ghost"
              onClick={() => {
                sessionStorage.removeItem(BUILDER_ENTER_KEY);
                window.location.hash = '#/builder';
              }}
            >
              নির্মাতা প্যানেলে ফিরুন
            </button>
          </div>
        )}

        <div id="page">{children}</div>
      </div>
    </div>
  );
}
