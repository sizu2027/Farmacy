import React, { useState } from 'react';
import { salesReport, stockReport, duesReport, fmt, num, todayStr } from '../lib/store.js';

/* Reports — sales (date range), stock value, and dues summaries. */
export default function Reports({ user }) {
  const firstOfMonth = todayStr().slice(0, 7) + '-01';
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr());
  const [sales, setSales] = useState(null);   // {from,to,sales,totals}
  const [stock, setStock] = useState(null);   // {medicines,totalValue}
  const [dues, setDues] = useState(null);     // {sales,purchases,totalDue}

  function loadSales() {
    setSales(salesReport(from, to));
  }
  function loadStock() {
    setStock(stockReport());
  }
  function loadDues() {
    setDues(duesReport());
  }

  const t = sales ? sales.totals : null;

  return (
    <div>
      <div className="topbar"><h2>📊 রিপোর্ট</h2></div>

      {/* ---------- Sales report ---------- */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>📈 বিক্রি রিপোর্ট</h3>
        <div className="toolbar">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" onClick={loadSales}>দেখুন</button>
        </div>
        {sales && (
          <div>
            <div className="cards">
              <div className="card stat"><div className="num">{num(t.count)}</div><div className="lbl">লেনদেন</div></div>
              <div className="card stat"><div className="num">{fmt(t.total)}</div><div className="lbl">মোট বিক্রি</div></div>
              <div className="card stat"><div className="num">{fmt(t.discount)}</div><div className="lbl">ছাড়</div></div>
              <div className="card stat"><div className="num">{fmt(t.paid)}</div><div className="lbl">আদায়</div></div>
              <div className="card stat danger"><div className="num">{fmt(t.due)}</div><div className="lbl">বকেয়া</div></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>মোট</th><th>ছাড়</th><th>পরিশোধ</th><th>বকেয়া</th></tr>
                </thead>
                <tbody>
                  {sales.sales.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--muted)' }}>এই সময়ে কোনো বিক্রি নেই।</td></tr>
                  ) : sales.sales.map((r) => (
                    <tr key={r.id}>
                      <td>{r.invoice_no}</td>
                      <td>{r.customer_name || '-'}</td>
                      <td>{r.date}</td>
                      <td>{fmt(r.total)}</td>
                      <td>{fmt(r.discount)}</td>
                      <td>{fmt(r.paid)}</td>
                      <td>{r.due > 0 ? <span className="badge red">{fmt(r.due)}</span> : <span className="badge green">{fmt(0)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Stock report ---------- */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>📦 স্টক রিপোর্ট</h3>
        <div className="toolbar">
          <button className="btn" onClick={loadStock}>দেখুন</button>
        </div>
        {stock && (
          <div>
            <div className="cards">
              <div className="card stat"><div className="num">{fmt(stock.totalValue)}</div><div className="lbl">মোট স্টক মূল্য</div></div>
              <div className="card stat"><div className="num">{num(stock.medicines.length)}</div><div className="lbl">ওষুধের সংখ্যা</div></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ওষুধ</th><th>স্টক</th><th>বিক্রয়মূল্য</th><th>মূল্য</th></tr>
                </thead>
                <tbody>
                  {stock.medicines.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{num(m.stock)}</td>
                      <td>{fmt(m.sale_price)}</td>
                      <td>{fmt(m.stock_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Dues report ---------- */}
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>💰 বকেয়া রিপোর্ট</h3>
        <div className="toolbar">
          <button className="btn" onClick={loadDues}>দেখুন</button>
        </div>
        {dues && (
          <div>
            <div className="cards">
              <div className="card stat danger"><div className="num">{fmt(dues.totalDue)}</div><div className="lbl">মোট বকেয়া</div></div>
            </div>
            <h4>🧍 কাস্টমার বকেয়া</h4>
            {dues.sales.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>কোনো বকেয়া নেই।</p>
            ) : (
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table>
                  <thead><tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>বকেয়া</th></tr></thead>
                  <tbody>
                    {dues.sales.map((r) => (
                      <tr key={r.id}>
                        <td>{r.invoice_no}</td>
                        <td>{r.customer_name || '-'}</td>
                        <td>{r.date}</td>
                        <td><span className="badge red">{fmt(r.due)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h4>🏭 সাপ্লায়ার বকেয়া</h4>
            {dues.purchases.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>কোনো বকেয়া নেই।</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>ইনভয়েস</th><th>সাপ্লায়ার</th><th>তারিখ</th><th>বকেয়া</th></tr></thead>
                  <tbody>
                    {dues.purchases.map((r) => (
                      <tr key={r.id}>
                        <td>{r.invoice_no || '-'}</td>
                        <td>{r.supplier_name}</td>
                        <td>{r.date}</td>
                        <td><span className="badge red">{fmt(r.due)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
