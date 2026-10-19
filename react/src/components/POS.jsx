import React, { useRef, useState } from 'react';
import {
  listMedicines, addSale, getSale, fmt, num, todayStr,
} from '../lib/store.js';

/* POS (Point of Sale) — search medicines, build a cart, complete the sale,
 * then show a printable invoice below. */
export default function POS({ user }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // [{id, name, sale_price, stock, qty}]
  const [discount, setDiscount] = useState(0); // live, for grand-total display
  const [invoice, setInvoice] = useState(null); // {sale, items, settings}
  const formRef = useRef(null);

  function onSearch(v) {
    setQ(v);
    if (v.trim().length >= 2) {
      setResults(listMedicines({ q: v.trim() }).slice(0, 12));
    } else {
      setResults([]);
    }
  }

  function addToCart(m) {
    const stock = m.stock || 0;
    const line = cart.find((l) => l.id === m.id);
    const nextQty = (line ? line.qty : 0) + 1;
    if (nextQty > stock) {
      alert('স্টক পর্যাপ্ত নয়।');
      return;
    }
    if (line) {
      setCart(cart.map((l) => (l.id === m.id ? { ...l, qty: l.qty + 1 } : l)));
    } else {
      setCart([...cart, { id: m.id, name: m.name, sale_price: m.sale_price, stock, qty: 1 }]);
    }
  }

  function setQty(id, d) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = l.qty + d;
        if (next > l.stock) {
          alert('স্টক পর্যাপ্ত নয়।');
          return l;
        }
        return next < 1 ? null : { ...l, qty: next };
      }).filter(Boolean)
    );
  }

  function removeLine(id) {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }

  const subtotal = cart.reduce((a, l) => a + l.qty * (l.sale_price || 0), 0);
  const grand = Math.max(0, subtotal - (parseInt(discount, 10) || 0));

  function completeSale() {
    if (cart.length === 0) {
      alert('কার্ট খালি।');
      return;
    }
    const f = formRef.current;
    const val = (n) => {
      const el = f && f.querySelector('[name="' + n + '"]');
      return el ? el.value : '';
    };
    const clear = (n) => {
      const el = f && f.querySelector('[name="' + n + '"]');
      if (el) el.value = '';
    };
    try {
      const res = addSale(
        {
          customer_name: val('cust_name'),
          customer_phone: val('cust_phone'),
          items: cart.map((l) => ({ medicine_id: l.id, qty: l.qty })),
          discount: val('discount'),
          paid: val('paid'),
          date: todayStr(),
        },
        user && user.id
      );
      const inv = getSale(res.id);
      setCart([]);
      clear('cust_name');
      clear('cust_phone');
      clear('discount');
      clear('paid');
      setDiscount(0);
      setQ('');
      setResults([]);
      setInvoice(inv);
    } catch (e) {
      alert(e.message || 'বিক্রি সম্পন্ন করা যায়নি।');
    }
  }

  const s = invoice ? invoice.sale : null;
  const st = invoice ? invoice.settings || {} : {};

  return (
    <div>
      <div className="topbar"><h2>💊 বিক্রি (POS)</h2></div>
      <div className="pos-grid">
        {/* left: medicine search */}
        <div className="card">
          <h3>🔍 ওষুধ খুঁজুন</h3>
          <div className="field">
            <input
              type="search"
              placeholder="ওষুধের নাম লিখুন (কমপক্ষে ২ অক্ষর)..."
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          {results.length === 0 && q.trim().length >= 2 && (
            <p style={{ color: 'var(--muted)' }}>কোনো ওষুধ পাওয়া যায়নি।</p>
          )}
          {results.map((m) => (
            <div className="result-item" key={m.id}>
              <div>
                <div style={{ fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {fmt(m.sale_price)} • স্টক: {num(m.stock)}
                </div>
              </div>
              <button
                className="btn small"
                disabled={m.stock <= 0}
                onClick={() => addToCart(m)}
              >
                যোগ
              </button>
            </div>
          ))}
        </div>

        {/* right: cart / bill */}
        <div className="card">
          <h3>🧾 বিল</h3>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>কার্ট খালি। বাম থেকে ওষুধ যোগ করুন।</p>
          ) : (
            cart.map((l) => (
              <div className="result-item" key={l.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {fmt(l.sale_price)} × {num(l.qty)} = {fmt(l.qty * l.sale_price)}
                  </div>
                </div>
                <div className="qty-ctrl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" onClick={() => setQty(l.id, -1)}>−</button>
                  <span style={{ fontWeight: 700 }}>{num(l.qty)}</span>
                  <button type="button" onClick={() => setQty(l.id, 1)}>+</button>
                  <button type="button" onClick={() => removeLine(l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              </div>
            ))
          )}
          <div ref={formRef}>
            <div className="totals" style={{ marginTop: 10 }}>
              <div className="row"><span>সাবটোটাল:</span><span>{fmt(subtotal)}</span></div>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label>কাস্টমারের নাম</label>
              <input name="cust_name" type="text" placeholder="নাম" />
            </div>
            <div className="field">
              <label>ফোন</label>
              <input name="cust_phone" type="text" placeholder="মোবাইল নম্বর" />
            </div>
            <div className="grid2">
              <div className="field">
                <label>ছাড় (৳)</label>
                <input
                  name="discount"
                  type="number"
                  min="0"
                  defaultValue=""
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="field">
                <label>পরিশোধ (৳)</label>
                <input name="paid" type="number" min="0" />
              </div>
            </div>
            <div className="totals">
              <div className="row grand"><span>মোট:</span><span>{fmt(grand)}</span></div>
            </div>
            <button className="btn block" style={{ marginTop: 12 }} onClick={completeSale}>
              বিক্রি সম্পন্ন করুন
            </button>
          </div>
        </div>
      </div>

      {/* invoice */}
      {invoice && s && (
        <div id="print-area">
          <div className="card" style={{ marginTop: 14 }}>
            <div className="invoice" id="invoice-doc">
              <h2>{st.pharmacy_name || 'ফার্মেসি'}</h2>
              <div className="meta">
                {st.pharmacy_address || ''}{st.pharmacy_phone ? ' • ' + st.pharmacy_phone : ''}
              </div>
              <p>
                <strong>ইনভয়েস:</strong> {s.invoice_no}<br />
                <strong>তারিখ:</strong> {s.date}<br />
                <strong>কাস্টমার:</strong> {s.customer_name || '-'}{s.customer_phone ? ' (' + s.customer_phone + ')' : ''}
              </p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>ওষুধ</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr></thead>
                  <tbody>
                    {invoice.items.map((it, i) => (
                      <tr key={i}>
                        <td>{num(i + 1)}</td>
                        <td>{it.medicine_name}</td>
                        <td>{num(it.qty)}</td>
                        <td>{fmt(it.price)}</td>
                        <td>{fmt(it.qty * it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="totals" style={{ marginTop: 10 }}>
                <div className="row"><span>ছাড়:</span><span>{fmt(s.discount)}</span></div>
                <div className="row grand"><span>সর্বমোট:</span><span>{fmt(s.total)}</span></div>
                <div className="row"><span>পরিশোধ:</span><span>{fmt(s.paid)}</span></div>
                <div className="row"><span>বকেয়া:</span><span>{fmt(s.due)}</span></div>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--muted)' }}>{st.invoice_footer || ''}</p>
            </div>
            <div className="no-print" style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="btn" onClick={() => window.print()}>🖨️ প্রিন্ট</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
