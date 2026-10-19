import React, { useState } from 'react';
import { listUsers, addUser, setUserActive, roleName } from '../lib/store.js';
import Modal, { Field } from './Modal.jsx';

/* User management — master_admin only (App guards the route). */

export default function Users({ user }) {
  const [showModal, setShowModal] = useState(false);
  const [err, setErr] = useState('');
  // Mutable refresh pattern: store is synchronous, read during render.
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);

  const users = listUsers();

  async function handleToggle(u) {
    const next = u.active ? 0 : 1;
    const label = u.active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন';
    if (!window.confirm(`"${u.full_name}" (${u.username}) — ${label} ?`)) return;
    try {
      setErr('');
      setUserActive(u.id, next, user.id);
      reload();
    } catch (e) {
      setErr(e.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  async function handleAdd(data) {
    // onSubmit throws on validation failure; Modal shows the message.
    await addUser(data, user.id);
    reload();
  }

  return (
    <div>
      <div className="topbar">
        <h2>ইউজার ব্যবস্থাপনা</h2>
        <button className="btn" onClick={() => setShowModal(true)}>+ নতুন ইউজার</button>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>নাম</th>
              <th>ইউজারনেম</th>
              <th>রোল</th>
              <th>অবস্থা</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td>{roleName(u.role)}</td>
                <td>
                  {u.active
                    ? <span className="badge green">সক্রিয়</span>
                    : <span className="badge grey">নিষ্ক্রিয়</span>}
                </td>
                <td>
                  <button className="btn small ghost" onClick={() => handleToggle(u)}>
                    {u.active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="নতুন ইউজার" onClose={() => setShowModal(false)} onSubmit={handleAdd}>
          <div className="form-grid">
            <Field name="fullName" label="নাম *" required full />
            <Field name="username" label="ইউজারনেম *" required />
            <Field name="password" label="পাসওয়ার্ড *" type="password" required />
            <Field
              name="role"
              label="রোল"
              defaultValue="staff"
              full
              options={[
                { value: 'staff', label: 'স্টাফ' },
                { value: 'master_admin', label: 'মাস্টার অ্যাডমিন' },
              ]}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
