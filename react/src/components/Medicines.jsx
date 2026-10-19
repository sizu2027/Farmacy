import React, { useEffect, useRef, useState } from 'react';
import Modal, { Field } from './Modal.jsx';
import { listMedicines, addMedicine, updateMedicine, deleteMedicine, listSuppliers, num, fmt } from '../lib/store.js';
import { MEDICINE_DB } from '../data/medicines.js';

/* Medicine name autocomplete: suggests from MEDICINE_DB (767 entries).
 * Picking a match sets the name and fills generic/company when empty.
 */
function AutocompleteName({ value, onPick }) {
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);

  const q = text.trim().toLowerCase();
  const matches =
    q.length >= 2
      ? MEDICINE_DB.filter(
          (d) =>
            String(d.name || '').toLowerCase().includes(q) ||
            String(d.generic || '').toLowerCase().includes(q)
        ).slice(0, 8)
      : [];

  function pick(d) {
    setText(d.name || '');
    setOpen(false);
    if (onPick) onPick(d);
  }

  return (
    <>
      <input
        name="name"
        type="text"
        value={text}
        required
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 && (
        <div className="ac-list">
          {matches.map((d, i) => (
            <div
              key={i}
              className="ac-item"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(d);
              }}
            >
              {d.name}
              <small>
                {[d.generic, d.company, d.strength, d.form].filter(Boolean).join(' • ')}
              </small>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* Add/Edit medicine form inside the modal. */
function MedicineForm({ m, suppliers, onDone }) {
  m = m || {};
  const genRef = useRef(null);
  const compRef = useRef(null);

  function handlePick(d) {
    if (genRef.current && !genRef.current.value.trim()) {
      genRef.current.value = d.generic || '';
    }
    if (compRef.current && !compRef.current.value.trim()) {
      compRef.current.value = d.company || '';
    }
  }

  async function onSubmit(data) {
    if (m.id) {
      await updateMedicine(m.id, data);
    } else {
      await addMedicine(data);
    }
    onDone();
  }

  const supOpts = [{ value: '', label: '— নেই —' }].concat(
    suppliers.map((s) => ({ value: s.id, label: s.name }))
  );

  return (
    <Modal
      title={m.id ? 'ওষুধ এডিট' : 'নতুন ওষুধ'}
      onClose={onDone}
      onSubmit={onSubmit}
    >
      <div className="form-grid">
        <div className="field full">
          <label>নাম *</label>
          <div className="ac-wrap">
            <AutocompleteName value={m.name} onPick={handlePick} />
          </div>
        </div>
        <div className="field">
          <label>জেনেরিক নাম</label>
          <input name="generic_name" type="text" defaultValue={m.generic_name || ''} ref={genRef} />
        </div>
        <div className="field">
          <label>কোম্পানি</label>
          <input name="company" type="text" defaultValue={m.company || m.manufacturer || ''} ref={compRef} />
        </div>
        <Field name="strength" label="শক্তি" defaultValue={m.strength || ''} />
        <Field name="form" label="ধরন" defaultValue={m.form || ''} />
        <Field name="unit" label="একক" defaultValue={m.unit || 'পিস'} />
        <Field name="sku" label="SKU/কোড" defaultValue={m.sku || ''} />
        <Field name="store_number" label="স্টোর নম্বর" defaultValue={m.store_number || ''} placeholder="যেমন: B-12 / SHELF-3" />
        <Field name="purchase_price" label="ক্রয়মূল্য (৳)" type="number" min="0" defaultValue={m.purchase_price || 0} />
        <Field name="sale_price" label="বিক্রয়মূল্য (৳)" type="number" min="0" defaultValue={m.sale_price || 0} />
        <Field name="stock" label="স্টক" type="number" min="0" defaultValue={m.stock || 0} />
        <Field name="reorder_level" label="রি-অর্ডার লেভেল" type="number" min="0" defaultValue={m.reorder_level || 0} />
        <Field name="expiry_date" label="মেয়াদ (YYYY-MM-DD)" type="date" defaultValue={m.expiry_date || ''} />
        <Field
          name="supplier_id"
          label="সাপ্লায়ার"
          full
          options={supOpts}
          defaultValue={m.supplier_id != null ? m.supplier_id : ''}
        />
      </div>
    </Modal>
  );
}

export default function Medicines({ user }) {
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);
  const [q, setQ] = useState('');
  const [debq, setDebq] = useState('');
  const [lowstock, setLowstock] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebq(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const meds = listMedicines({ q: debq, lowstock, expiring });
  const suppliers = listSuppliers();

  function handleDelete(id) {
    if (!confirm('এই ওষুধটি মুছে ফেলবেন?')) return;
    try {
      deleteMedicine(id);
      reload();
    } catch (e) {
      alert(e.message || 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div>
      <div className="topbar">
        <h2>💊 ওষুধের মজুদ</h2>
        <button className="btn" onClick={() => { setEditing(null); setFormOpen(true); }}>
          + নতুন ওষুধ
        </button>
      </div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="🔍 ওষুধ খুঁজুন..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={lowstock} onChange={(e) => setLowstock(e.target.checked)} />
          লো স্টক
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={expiring} onChange={(e) => setExpiring(e.target.checked)} />
          মেয়াদ আসন্ন
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>নাম</th>
              <th>জেনেরিক</th>
              <th>কোম্পানি</th>
              <th>ক্রয়</th>
              <th>বিক্রয়</th>
              <th>স্টক</th>
              <th>স্টোর নং</th>
              <th>মেয়াদ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.generic_name || '-'}</td>
                <td>{m.company || '-'}</td>
                <td>{fmt(m.purchase_price)}</td>
                <td>{fmt(m.sale_price)}</td>
                <td>
                  {(m.stock || 0) <= (m.reorder_level || 0) ? (
                    <span className="badge amber">{num(m.stock)}</span>
                  ) : (
                    num(m.stock)
                  )}
                </td>
                <td>{m.store_number || '-'}</td>
                <td>{m.expiry_date || '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn small ghost"
                    onClick={() => { setEditing(m); setFormOpen(true); }}
                  >
                    এডিট
                  </button>{' '}
                  {user && user.role === 'master_admin' && (
                    <button className="btn small danger" onClick={() => handleDelete(m.id)}>
                      মুছুন
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {meds.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  কোনো ওষুধ নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {formOpen && (
        <MedicineForm
          m={editing}
          suppliers={suppliers}
          onDone={() => { setFormOpen(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
