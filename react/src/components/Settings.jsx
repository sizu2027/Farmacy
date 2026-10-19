import React, { useState } from 'react';
import { getSettings, updateSettings } from '../lib/store.js';
import { Field } from './Modal.jsx';

/* Pharmacy settings — master_admin only (App guards the route). */

export default function Settings() {
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);

  const s = getSettings();

  function handleSubmit(e) {
    e.preventDefault();
    setOk('');
    setErr('');
    const fd = new FormData(e.target);
    try {
      updateSettings({
        pharmacy_name: fd.get('pharmacy_name'),
        pharmacy_phone: fd.get('pharmacy_phone'),
        pharmacy_address: fd.get('pharmacy_address'),
        invoice_footer: fd.get('invoice_footer'),
        low_stock_threshold: parseInt(fd.get('low_stock_threshold'), 10),
        expiry_alert_days: parseInt(fd.get('expiry_alert_days'), 10),
      });
      setOk('সংরক্ষণ হয়েছে।');
      reload();
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  return (
    <div>
      <div className="topbar"><h2>⚙️ ফার্মেসি সেটিংস</h2></div>
      <div className="card">
        {err && <div className="error">{err}</div>}
        {ok && <div className="okmsg">{ok}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field name="pharmacy_name" label="ফার্মেসির নাম" defaultValue={s.pharmacy_name || ''} full />
            <Field name="pharmacy_phone" label="ফোন" defaultValue={s.pharmacy_phone || ''} />
            <Field name="pharmacy_address" label="ঠিকানা" defaultValue={s.pharmacy_address || ''} full />
            <div className="field full">
              <label>ইনভয়েস ফুটার বার্তা</label>
              <textarea name="invoice_footer" defaultValue={s.invoice_footer || ''} />
            </div>
            <Field
              name="low_stock_threshold"
              label="লো স্টক সীমা"
              type="number"
              min="0"
              defaultValue={s.low_stock_threshold ?? 10}
            />
            <Field
              name="expiry_alert_days"
              label="মেয়াদ সতর্কতা দিন"
              type="number"
              min="1"
              defaultValue={s.expiry_alert_days ?? 60}
            />
          </div>
          <button className="btn" type="submit">সংরক্ষণ</button>
        </form>
      </div>
    </div>
  );
}
