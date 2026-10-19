import React, { useEffect, useState } from 'react';
import {
  needsBuilderSetup, setupBuilder, login, logout, getSession,
  getSettings, setMaintenanceMode, setMaintenanceMessage,
} from '../lib/store.js';

/* Builder (super_admin) portal — fully self-contained, separate from the pharmacy portal. */

const ENTER_FLAG = 'farmacy_react_builder_enter';

function BackLink() {
  return (
    <div className="builder-link">
      <a href="#/login">← ফার্মেসি পোর্টালে ফিরুন</a>
    </div>
  );
}

function BuilderSetup({ onDone }) {
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const fd = new FormData(e.target);
    try {
      await setupBuilder({
        fullName: fd.get('fullName'),
        builderId: fd.get('builderId'),
        password: fd.get('password'),
      });
      onDone();
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🔧 নির্মাতা পোর্টাল</h1>
        <p className="sub">সফটওয়্যার নির্মাতার সুপার অ্যাডমিন সেটআপ (একবারের জন্য)</p>
        {err && <div className="error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>আপনার নাম</label>
            <input name="fullName" required autoComplete="name" />
          </div>
          <div className="field">
            <label>বিল্ডার আইডি (ইউজারনেম)</label>
            <input name="builderId" required autoComplete="username" />
          </div>
          <div className="field">
            <label>পাসওয়ার্ড</label>
            <input name="password" type="password" required autoComplete="new-password" />
          </div>
          <button className="btn block" type="submit">সেটআপ সম্পন্ন করুন</button>
        </form>
        <BackLink />
      </div>
    </div>
  );
}

function BuilderLogin({ onDone }) {
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const fd = new FormData(e.target);
    try {
      await login(fd.get('username'), fd.get('password'), 'builder');
      onDone();
    } catch (ex) {
      // Wrong-password message comes from store ('ভুল ইউজারনেম বা পাসওয়ার্ড।');
      // cross-portal errors are shown as-is.
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🔧 নির্মাতা লগইন</h1>
        <p className="sub">শুধু সফটওয়্যার নির্মাতার জন্য</p>
        {err && <div className="error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>বিল্ডার আইডি</label>
            <input name="username" required autoComplete="username" />
          </div>
          <div className="field">
            <label>পাসওয়ার্ড</label>
            <input name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn block" type="submit">লগইন</button>
        </form>
        <BackLink />
      </div>
    </div>
  );
}

function BuilderPanel({ onLogout }) {
  const [v, setV] = useState(0);
  const refresh = () => setV((x) => x + 1);
  const [err, setErr] = useState('');
  const [msgOk, setMsgOk] = useState('');

  const settings = getSettings();
  const online = settings.maintenance_mode === '1' || settings.software_online === '1';

  async function handleToggle(e) {
    const checked = e.target.checked;
    try {
      setErr('');
      setMaintenanceMode(checked);
      refresh();
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
      e.target.checked = !checked;
    }
  }

  async function handleSaveMsg() {
    setErr('');
    setMsgOk('');
    try {
      const ta = document.getElementById('maint-msg');
      setMaintenanceMessage(ta ? ta.value : '');
      setMsgOk('সংরক্ষণ হয়েছে।');
    } catch (ex) {
      setErr(ex.message || 'একটি সমস্যা হয়েছে।');
    }
  }

  function handleEnterMain() {
    sessionStorage.setItem(ENTER_FLAG, '1');
    window.location.hash = '#/dashboard';
  }

  function handleLogout() {
    logout('builder');
    sessionStorage.removeItem(ENTER_FLAG);
    window.location.hash = '#/login';
    if (onLogout) onLogout();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🔧 নির্মাতা প্যানেল</h1>
        <div className="big-panel">
          <p>
            <span className={'status-dot ' + (online ? 'on' : 'off')}></span>
            <strong>সফটওয়্যার: {online ? 'চালু আছে' : 'বন্ধ আছে'}</strong>
          </p>
          <label className="switch">
            <input id="online-toggle" type="checkbox" checked={online} onChange={handleToggle} />
            <span className="slider"></span>
          </label>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            বন্ধ থাকলে ফার্মেসি পোর্টালের সবাই রক্ষণাবেক্ষণ পেজ দেখবে।
          </p>
        </div>
        {err && <div className="error">{err}</div>}
        {msgOk && <div className="okmsg">{msgOk}</div>}
        <div className="field">
          <label>রক্ষণাবেক্ষণ বার্তা</label>
          <textarea id="maint-msg" defaultValue={settings.maintenance_message || ''} />
        </div>
        <button className="btn block" type="button" onClick={handleSaveMsg}>বার্তা সংরক্ষণ</button>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="btn ghost block" type="button" onClick={handleEnterMain} style={{ textAlign: 'center' }}>
            মূল প্যানেলে প্রবেশ
          </button>
          <button className="btn danger block" type="button" onClick={handleLogout}>
            লগআউট
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Builder() {
  const [mode, setMode] = useState('loading'); // 'setup' | 'login' | 'panel'

  function decide() {
    if (needsBuilderSetup()) setMode('setup');
    else if (getSession('builder')) setMode('panel');
    else setMode('login');
  }

  useEffect(() => { decide(); }, []);

  if (mode === 'setup') return <BuilderSetup onDone={() => setMode('panel')} />;
  if (mode === 'panel') return <BuilderPanel onLogout={() => setMode('login')} />;
  if (mode === 'login') return <BuilderLogin onDone={() => setMode('panel')} />;
  return (
    <div className="auth-wrap">
      <div className="auth-card"><p style={{ textAlign: 'center' }}>লোড হচ্ছে...</p></div>
    </div>
  );
}
