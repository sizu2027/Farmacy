import React, { useState } from 'react';

/* Reusable modal dialog.
 * Props: title, onClose, onSubmit (async, receives form data object) -> throws on validation error
 * children: form fields using name="..." inputs
 */
export default function Modal({ title, onClose, onSubmit, submitLabel = 'সংরক্ষণ', children }) {
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    try {
      await onSubmit(data, e.target);
      onClose();
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>{title}</h3>
        {err && <div className="error">{err}</div>}
        <form onSubmit={handleSubmit}>
          {children}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>বাতিল</button>
            <button type="submit" className="btn">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Simple labeled input field used inside modals/pages. */
export function Field({ name, label, type = 'text', defaultValue = '', required = false, full = false, min, step, placeholder, options }) {
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label>{label}</label>
      {options ? (
        <select name={name} defaultValue={defaultValue} required={required}>
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          min={min}
          step={step}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
