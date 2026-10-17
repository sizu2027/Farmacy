# ফার্মেসি ম্যানেজমেন্ট সফটওয়্যার (Farmacy App)

Bengali-language Pharmacy Management Software — Node.js + Express + SQLite.
সম্পূর্ণ বাংলা ইন্টারফেসের ফার্মেসি হিসাব-নিকাশ সফটওয়্যার।

## Features / ফিচারসমূহ

- 💊 **ওষুধের মজুদ (Inventory)** — যোগ/এডিট/ডিলিট, সার্চ, SKU
- ⚠️ **সতর্কবার্তা (Alerts)** — লো-স্টক ও মেয়াদোত্তীর্ণ/মেয়াদ-আসন্ন ওষুধের অ্যালার্ট
- 🏭 **সাপ্লায়ার** — CRUD
- 🛒 **ক্রয় (Stock-in)** — কিনলে স্টক স্বয়ংক্রিয়ভাবে বাড়ে
- 🧾 **বিক্রি/POS বিলিং** — কার্ট, ছাড়, বাকি, ইনভয়েস প্রিন্ট
- 💰 **বকেয়া (Dues)** — কাস্টমার ও সাপ্লায়ার বকেয়া, টাকা আদায়
- 📈 **রিপোর্ট** — তারিখ অনুযায়ী বিক্রি রিপোর্ট, স্টক রিপোর্ট
- 👥 **ইউজার ও রোল** — Master Admin, Staff
- 👑 **Super Admin (Builder) পোর্টাল** — আলাদা লগইন; সফটওয়্যার ON/OFF, রক্ষণাবেক্ষণ বার্তা
- 📱 **রেসপন্সিভ** — মোবাইল ও ল্যাপটপ

## Install & Run / চালানো

Requirements: **Node.js 18+**

```bash
npm install
node server.js
```

Then open / তারপর খুলুন:

- 💊 Pharmacy portal: http://localhost:3000
- 🔧 Builder portal:   http://localhost:3000/builder

The SQLite database file `farmacy.db` is created automatically on first run.
প্রথমবার চালালে `farmacy.db` ফাইল নিজে নিজে তৈরি হয়ে যাবে।

## First-time flows / প্রথমবারের ধাপ

### Pharmacy portal (দোকানের প্যানেল)
1. প্রথমবার খুললে **মাস্টার অ্যাডমিন সেটআপ** ফর্ম আসবে — ফার্মেসির নাম, আপনার নাম, ইউজারনেম, পাসওয়ার্ড দিন।
2. এরপর থেকে **ফার্মেসি লগইন** ফর্মে সেই ইউজারনেম/পাসওয়ার্ড দিয়ে ঢুকুন।
3. Master Admin **ইউজার** মেনু থেকে স্টাফ অ্যাকাউন্ট বানাতে পারবে।

### Builder portal (সফটওয়্যার নির্মাতার প্যানেল)
1. `/builder` খুললে প্রথমবার **বিল্ডার সুপার অ্যাডমিন সেটআপ** — নাম, বিল্ডার আইডি, পাসওয়ার্ড।
2. এখান থেকে সফটওয়্যার **ON/OFF** করা যায়। OFF থাকলে ফার্মেসি পোর্টালের সবাই রক্ষণাবেক্ষণ পেজ দেখবে; শুধু বিল্ডার ঢুকে আবার ON করতে পারবে।
3. দুই পোর্টালের লগইন সম্পূর্ণ আলাদা — এক পোর্টালের আইডি অন্য পোর্টালে কাজ করবে না।

## Project structure

```
farmacy-app/
├── server.js          # Express API + static serving
├── db.js              # SQLite schema + settings seed
├── package.json
├── public/
│   ├── index.html     # Pharmacy portal
│   ├── builder.html   # Builder (Super Admin) portal
│   ├── css/style.css
│   └── js/
│       ├── app.js     # Pharmacy frontend
│       └── builder.js # Builder frontend
└── farmacy.db         # auto-created SQLite database (gitignored)
```

## Notes

- All prices are **INTEGER taka** (no decimals) to avoid float issues.
- Passwords are hashed with **bcryptjs**.
- Sessions are in-memory tokens (Bearer header); server restart logs everyone out.
- `software_online = '0'` puts the pharmacy portal in maintenance mode (builder bypasses).
