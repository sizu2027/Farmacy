import React, { useState } from 'react';
import Modal, { Field } from './Modal.jsx';
import { getDues, collectDue, fmt } from '../lib/store.js';

/* Dues — customer dues (unpaid sales) and supplier dues (unpaid purchases),
 * with a collect modal for receiving/paying amounts. */
export default function Dues({ user }) {
  const [dues, setDues] = useState(() => getDues());
  const [collect, setCollect] = useState(null); // {type:'sale'|'purchase', id, due, label}

  function reload() {
    setDues(getDues());
  }

  async function handleCollect(data) {
    collectDue(collect.type, collect.id, data.amount);
    reload();
  }

  const sales = dues.sales || [];
  const purchases = dues.purchases || [];

  return (
    <div>
      <div className="topbar"><h2>💰 বকেয়া</h2></div>

      <div className="grid2">
        <div className="card">
          <h3>🧍 কাস্টমার বকেয়া</h3>
          {sales.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>কোনো বকেয়া নেই।</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ইনভয়েস</th><th>কাস্টমার</th><th>তারিখ</th><th>মোট</th><th>বকেয়া</th><th></th></tr>
                </thead>
                <tbody>
                  {sales.map((r) => (
                    <tr key={r.id}>
                      <td>{r.invoice_no}</td>
                      <td>{r.customer_name || '-'}</td>
                      <td>{r.date}</td>
                      <td>{fmt(r.total)}</td>
                      <td><span className="badge red">{fmt(r.due)}</span></td>
                      <td>
                        <button
                          className="btn small"
                          onClick={() => setCollect({ type: 'sale', id: r.id, due: r.due, label: r.invoice_no })}
                        >
                          টাকা নিন
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3>🏭 সাপ্লায়ার বকেয়া</h3>
          {purchases.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>কোনো বকেয়া নেই।</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ইনভয়েস</th><th>সাপ্লায়ার</th><th>তারিখ</th><th>মোট</th><th>বকেয়া</th><th></th></tr>
                </thead>
                <tbody>
                  {purchases.map((r) => (
                    <tr key={r.id}>
                      <td>{r.invoice_no || '-'}</td>
                      <td>{r.supplier_name}</td>
                      <td>{r.date}</td>
                      <td>{fmt(r.total)}</td>
                      <td><span className="badge red">{fmt(r.due)}</span></td>
                      <td>
                        <button
                          className="btn small"
                          onClick={() => setCollect({ type: 'purchase', id: r.id, due: r.due, label: r.invoice_no || '-' })}
                        >
                          পরিশোধ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {collect && (
        <Modal
          title="বকেয়া আদায়"
          submitLabel={collect.type === 'sale' ? 'টাকা নিন' : 'পরিশোধ করুন'}
          onClose={() => setCollect(null)}
          onSubmit={handleCollect}
        >
          <p>ইনভয়েস: <strong>{collect.label}</strong></p>
          <p>বকেয়া: <strong>{fmt(collect.due)}</strong></p>
          <Field name="amount" label="পরিমাণ (৳)" type="number" min="1" required defaultValue={collect.due} full />
        </Modal>
      )}
    </div>
  );
}
