import React, { useState } from 'react';
import { setupMaster, login, getSettings } from '../lib/store.js';
import { Field } from './Modal.jsx';

/* First-run master admin setup. On success, onDone() refreshes App state. */
export function SetupMaster({ onDone }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const fd = new FormData(e.target);
    try {
      await setupMaster({
        pharmacyName: fd.get('pharmacyName'),
        fullName: fd.get('fullName'),
        username: fd.get('username'),
        password: fd.get('password'),
      });
      onDone();
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>💊 ফার্মেসি সফটওয়্যার</h1>
        <p className="sub">প্রথমবার: মাস্টার অ্যাডমিন সেটআপ</p>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit}>
          <Field name="pharmacyName" label="ফার্মেসির নাম" required />
          <Field name="fullName" label="আপনার নাম" required />
          <Field name="username" label="ইউজারনেম" required />
          <Field name="password" label="পাসওয়ার্ড" type="password" required />
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'লোড হচ্ছে...' : 'সেটআপ সম্পন্ন করুন'}
          </button>
        </form>
        <div className="builder-link">
          <a href="#/builder">সফটওয়্যার নির্মাতার পোর্টাল</a>
        </div>
      </div>
    </div>
  );
}

/* Pharmacy portal login (master_admin / staff). On success, onDone() refreshes App state. */
export function Login({ onDone }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showMaint, setShowMaint] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const fd = new FormData(e.target);
    try {
      await login(fd.get('username'), fd.get('password'), 'pharmacy');
      onDone();
    } catch (ex) {
      if (ex.maintenance) {
        setShowMaint(true); // maintenance error shows maintenance page instead
      } else {
        setErr(ex.message || 'ভুল ইউজারনেম বা পাসওয়ার্ড।');
      }
    } finally {
      setBusy(false);
    }
  }

  if (showMaint) {
    return <Maintenance onRetry={() => setShowMaint(false)} />;
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>💊 ফার্মেসি লগইন</h1>
        <p className="sub">মাস্টার অ্যাডমিন / স্টাফ</p>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit}>
          <Field name="username" label="ইউজারনেম" required />
          <Field name="password" label="পাসওয়ার্ড" type="password" required />
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'লোড হচ্ছে...' : 'লগইন'}
          </button>
        </form>
        <div className="builder-link">
          <a href="#/builder">সফটওয়্যার নির্মাতার পোর্টাল</a>
        </div>
      </div>
    </div>
  );
}

/* Shown when the software is turned OFF (maintenance mode). */
export function Maintenance({ onRetry }) {
  let msg = '';
  try {
    msg = getSettings().maintenance_message || '';
  } catch (e) {
    msg = '';
  }
  return (
    <div className="maintenance">
      <div className="box">
        <h2>🛠️ রক্ষণাবেক্ষণ চলছে</h2>
        <p>{msg}</p>
        <button className="btn" onClick={onRetry}>আবার চেষ্টা করুন</button>
      </div>
    </div>
  );
}
