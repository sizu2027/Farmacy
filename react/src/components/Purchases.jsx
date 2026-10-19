import React, { useState } from 'react';
import Modal, { Field } from './Modal.jsx';
import { listPurchases, addPurchase, listMedicines, listSuppliers, todayStr, fmt } from '../lib/store.js';

let rowKey = 0;
function newRow() {
  return { key: ++rowKey, medicine_id: '', qty: 1, price: 0 };
}

/* New purchase form with dynamic item rows (React state). */
function PurchaseForm({ suppliers, meds, onDone, createdBy }) {
  const [rows, setRows] = useState([newRow()]);

  function updateRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  function addRow() {
    setRows((rs) => rs.concat([newRow()]));
  }

  function pickMedicine(key, mid) {
    const m = meds.find((x) => String(x.id) === String(mid));
    updateRow(key, {
      medicine_id: mid,
      price: m ? m.purchase_price || 0 : 0,
    });
  }

  const medOpts = [{ value: '', label: '— ওষুধ বাছুন —' }].concat(
    meds.map((m) => ({ value: m.id, label: `${m.name} (${fmt(m.purchase_price)})` }))
  );
  const supOpts = [{ value: '', label: '— নেই —' }].concat(
    suppliers.map((s) => ({ value: s.id, label: s.name }))
  );

  async function onSubmit(data) {
    const items = rows
      .map((r) => ({
        medicine_id: r.medicine_id ? parseInt(r.medicine_id, 10) : 0,
        qty: parseInt(r.qty, 10) || 0,
        price: parseInt(r.price, 10) || 0,
      }))
      .filter((it) => it.medicine_id && it.qty > 0);
    if (items.length === 0) throw new Error('কমপক্ষে একটি আইটেম দিন।');
    await addPurchase(
      {
        supplier_id: data.supplier_id || '',
        invoice_no: data.invoice_no || '',
        date: data.date || todayStr(),
        paid: data.paid || 0,
        items,
      },
      createdBy
    );
    onDone();
  }

  return (
    <Modal title="নতুন ক্রয়" onClose={onDone} onSubmit={onSubmit}>
      <div className="form-grid">
        <Field name="supplier_id" label="সাপ্লায়ার" options={supOpts} defaultValue="" />
        <Field name="invoice_no" label="ইনভয়েস নং" />
        <Field name="date" label="তারিখ" type="date" defaultValue={todayStr()} />
        <Field name="paid" label="পরিশোধ (৳)" type="number" min="0" defaultValue={0} />
      </div>
      <h4>আইটেম</h4>
      {rows.map((r) => (
        <div key={r.key} className="result-item pur-row">
          <select
            value={r.medicine_id}
            onChange={(e) => pickMedicine(r.key, e.target.value)}
            style={{ flex: 1 }}
          >
            {medOpts.map((o) => (
              <option key={String(o.value)} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={r.qty}
            onChange={(e) => updateRow(r.key, { qty: e.target.value })}
            style={{ width: 70 }}
            placeholder="পরিমাণ"
          />
          <input
            type="number"
            min="0"
            value={r.price}
            onChange={(e) => updateRow(r.key, { price: e.target.value })}
            style={{ width: 90 }}
            placeholder="দাম"
          />
          <button type="button" className="btn small ghost" onClick={() => removeRow(r.key)}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={addRow} style={{ marginTop: 8 }}>
        + আইটেম যোগ
      </button>
    </Modal>
  );
}

export default function Purchases({ user }) {
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);
  const [formOpen, setFormOpen] = useState(false);

  const purchases = listPurchases();
  const suppliers = listSuppliers();
  const meds = listMedicines({});

  function openNew() {
    if (meds.length === 0) {
      alert('আগে ওষুধ যোগ করুন।');
      return;
    }
    setFormOpen(true);
  }

  return (
    <div>
      <div className="topbar">
        <h2>🛒 ক্রয়</h2>
        <button className="btn" onClick={openNew}>
          + নতুন ক্রয়
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>তারিখ</th>
              <th>সাপ্লায়ার</th>
              <th>ইনভয়েস</th>
              <th>মোট</th>
              <th>পরিশোধ</th>
              <th>বকেয়া</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td>{p.supplier_name || '-'}</td>
                <td>{p.invoice_no || '-'}</td>
                <td>{fmt(p.total)}</td>
                <td>{fmt(p.paid)}</td>
                <td>
                  {(p.due || 0) > 0 ? <span className="badge red">{fmt(p.due)}</span> : '-'}
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  কোনো ক্রয় নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {formOpen && (
        <PurchaseForm
          suppliers={suppliers}
          meds={meds}
          createdBy={user && user.id}
          onDone={() => { setFormOpen(false); reload(); }}
        />
      )}
    </div>
  );
}
