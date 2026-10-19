import React, { useState } from 'react';
import Modal, { Field } from './Modal.jsx';
import { listSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../lib/store.js';

function SupplierForm({ s, onDone }) {
  s = s || {};

  async function onSubmit(data) {
    if (s.id) {
      await updateSupplier(s.id, data);
    } else {
      await addSupplier(data);
    }
    onDone();
  }

  return (
    <Modal
      title={s.id ? 'সাপ্লায়ার এডিট' : 'নতুন সাপ্লায়ার'}
      onClose={onDone}
      onSubmit={onSubmit}
    >
      <div className="form-grid">
        <Field name="name" label="নাম *" required full defaultValue={s.name || ''} />
        <Field name="phone" label="ফোন" defaultValue={s.phone || ''} />
        <Field name="address" label="ঠিকানা" full defaultValue={s.address || ''} />
      </div>
    </Modal>
  );
}

export default function Suppliers({ user }) {
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const suppliers = listSuppliers();

  function handleDelete(id) {
    if (!confirm('এই সাপ্লায়ার মুছে ফেলবেন?')) return;
    try {
      deleteSupplier(id);
      reload();
    } catch (e) {
      alert(e.message || 'মুছে ফেলা যায়নি।');
    }
  }

  return (
    <div>
      <div className="topbar">
        <h2>🏭 সাপ্লায়ার</h2>
        <button className="btn" onClick={() => { setEditing(null); setFormOpen(true); }}>
          + নতুন সাপ্লায়ার
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>নাম</th>
              <th>ফোন</th>
              <th>ঠিকানা</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.phone || '-'}</td>
                <td>{s.address || '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn small ghost"
                    onClick={() => { setEditing(s); setFormOpen(true); }}
                  >
                    এডিট
                  </button>{' '}
                  {user && user.role === 'master_admin' && (
                    <button className="btn small danger" onClick={() => handleDelete(s.id)}>
                      মুছুন
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  কোনো সাপ্লায়ার নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {formOpen && (
        <SupplierForm
          s={editing}
          onDone={() => { setFormOpen(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}
