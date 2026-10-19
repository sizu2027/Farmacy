# Farmacy React — ফার্মেসি ইনভেন্টরি ম্যানেজমেন্ট

React 18 + Vite version of the Farmacy pharmacy inventory app. **Fully client-side** — no backend, no database server. All data persists in the browser's `localStorage` (key `farmacy_react_v1`).

## চালানো (Run)

```bash
npm install
npm run dev
```

Then open http://localhost:5173 — hash routing (`#/login`, `#/dashboard`, `#/medicines`, `#/suppliers`, `#/purchases`, `#/pos`, `#/dues`, `#/reports`, `#/users`, `#/settings`, `#/builder`).

Production build:

```bash
npm run build   # outputs to dist/
```

## ফিচার (Features)

- **প্রথমবার সেটআপ**: Master Admin তৈরি (username/password) + ডেমো ডেটা (কয়েকটি ওষুধ, ১টি সাপ্লায়ার)
- **ড্যাশবোর্ড**: পরিসংখ্যান কার্ড, লো-স্টক ও মেয়াদ-আসন্ন অ্যালার্ট, সাম্প্রতিক বিক্রি
- **ওষুধের মজুদ**: CRUD + **৭৬৭টি যাচাইকৃত বাংলাদেশি ওষুধের অটোকমপ্লিট** + স্টোর নম্বর
- **সাপ্লায়ার**: CRUD
- **ক্রয়**: স্টক-ইন (সাপ্লায়ার, একাধিক আইটেম) → স্টক বাড়ে
- **POS**: কার্ট, ছাড়, বকেয়া (কাস্টমার নাম/ফোন), `INV-<timestamp>` ইনভয়েস, প্রিন্ট; স্টক কমে, অপর্যাপ্ত স্টকে বিক্রি বাতিল
- **বকেয়া**: কাস্টমার + সাপ্লায়ার বকেয়া, টাকা আদায়/পরিশোধ
- **রিপোর্ট**: বিক্রি (তারিখ রেঞ্জ), স্টক, বকেয়া
- **ইউজার** (মাস্টার অ্যাডমিন): স্টাফ তৈরি, সক্রিয়/নিষ্ক্রিয়
- **সেটিংস**: ফার্মেসি প্রোফাইল, ইনভয়েস ফুটার, লো-স্টক সীমা, মেয়াদ সতর্কতা দিন
- **নির্মাতা পোর্টাল** (`#/builder`, আলাদা লগইন): সফটওয়্যার ON/OFF + রক্ষণাবেক্ষণ বার্তা; OFF থাকলে ফার্মেসি পোর্টালে রক্ষণাবেক্ষণ পেজ; "মূল প্যানেলে প্রবেশ" বাটন

## নিরাপত্তা নোট

- পাসওয়ার্ড SHA-256 হ্যাশ করে সংরক্ষণ করা হয় (plaintext নয়)
- সেশন `sessionStorage`-এ থাকে; ফার্মেসি ও নির্মাতা পোর্টালের সেশন সম্পূর্ণ আলাদা

## ফাইল কাঠামো

```
src/
  main.jsx            — entry
  App.jsx             — hash router + auth/maintenance gates
  styles.css          — Bengali UI styles
  data/medicines.js   — 767 verified BD medicines (autocomplete source)
  lib/store.js        — localStorage data layer (the "backend")
  components/
    Auth.jsx          — Setup / Login / Maintenance
    Layout.jsx        — sidebar shell + NAV
    Dashboard.jsx, Medicines.jsx, Suppliers.jsx, Purchases.jsx
    POS.jsx, Dues.jsx, Reports.jsx, Users.jsx, Settings.jsx
    Builder.jsx       — super-admin portal
    Modal.jsx         — reusable modal + Field
```

## Google AI Studio / v0.app

This is a standard Vite + React project — paste any file into AI Studio or v0 to edit, or import the folder as-is.
