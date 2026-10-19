import React, { useEffect, useState } from 'react';
import { dashboard, fmt, num } from '../lib/store.js';

/* Dashboard — stat cards, alert lists, recent sales table. */

function StatCard({ label, value, cls = '' }) {
  return (
    <div className={'card stat' + (cls ? ' ' + cls : '')}>
      <div className="num">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function AlertList({ items }) {
  if (!items.length) return <p style={{ color: 'var(--muted)' }}>সব ঠিক আছে।</p>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((m, i) => (
        <li key={m.key != null ? m.key : i}>{m}</li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  // Mutable refresh pattern: store is synchronous, read during render.
  const [v, setV] = useState(0);
  useEffect(() => { setV((x) => x + 1); }, []);

  const d = dashboard();
  const s = d.stats;

  return (
    <div>
      <div className="topbar"><h2>ড্যাশবোর্ড</h2></div>

      <div className="cards">
        <StatCard label="মোট ওষুধ" value={num(s.medicineCount)} />
        <StatCard label="মোট ইউনিট" value={num(s.totalUnits)} />
        <StatCard label="স্টক মূল্য" value={fmt(s.stockValue)} />
        <StatCard label="আজকের বিক্রি" value={fmt(s.todaySales)} />
        <StatCard label="আজকের লেনদেন" value={num(s.todayTransactions)} />
        <StatCard label="মোট বকেয়া" value={fmt(s.totalDue)} cls={s.totalDue > 0 ? 'danger' : ''} />
        <StatCard label="লো স্টক" value={num(s.lowStockCount)} cls={s.lowStockCount > 0 ? 'warn' : ''} />
        <StatCard label="মেয়াদ আসন্ন" value={num(s.expiringCount)} cls={s.expiringCount > 0 ? 'warn' : ''} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>⚠️ লো স্টক</h3>
          <AlertList
            items={d.alerts.lowStock.map((m) => (
              <span key={m.id}>
                <span className="badge amber">{num(m.stock)} {m.unit}</span> {m.name}
              </span>
            ))}
          />
        </div>
        <div className="card">
          <h3>⏳ মেয়াদ আসন্ন ({num(d.settings.expiry_alert_days)} দিন)</h3>
          <AlertList
            items={d.alerts.expiring.map((m) => (
              <span key={m.id}>{m.expiry_date} — {m.name}</span>
            ))}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>সাম্প্রতিক বিক্রি</h3>
        {d.recentSales.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>এখনো বিক্রি হয়নি।</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ইনভয়েস</th>
                  <th>কাস্টমার</th>
                  <th>মোট</th>
                  <th>বকেয়া</th>
                  <th>তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {d.recentSales.map((r) => (
                  <tr key={r.id}>
                    <td>{r.invoice_no}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td>{fmt(r.total)}</td>
                    <td>{r.due > 0 ? <span className="badge red">{fmt(r.due)}</span> : '-'}</td>
                    <td>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
