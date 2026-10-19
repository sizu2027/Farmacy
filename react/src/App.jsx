import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  getSession,
  needsMasterSetup,
  isSoftwareOnline,
  logout,
  seedIfNeeded,
} from './lib/store.js';
import Layout, { NAV, BUILDER_ENTER_KEY } from './components/Layout.jsx';
import { SetupMaster, Login, Maintenance } from './components/Auth.jsx';

const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const Medicines = lazy(() => import('./components/Medicines.jsx'));
const Suppliers = lazy(() => import('./components/Suppliers.jsx'));
const Purchases = lazy(() => import('./components/Purchases.jsx'));
const POS = lazy(() => import('./components/POS.jsx'));
const Dues = lazy(() => import('./components/Dues.jsx'));
const Reports = lazy(() => import('./components/Reports.jsx'));
const Users = lazy(() => import('./components/Users.jsx'));
const Settings = lazy(() => import('./components/Settings.jsx'));
/* Built by another agent: handles its own setup/login/panel internally. */
const Builder = lazy(() => import('./components/Builder.jsx'));

const PAGES = {
  dashboard: Dashboard,
  pos: POS,
  medicines: Medicines,
  purchases: Purchases,
  suppliers: Suppliers,
  dues: Dues,
  reports: Reports,
  users: Users,
  settings: Settings,
};

const KNOWN_ROUTES = new Set([...Object.keys(PAGES), 'login', 'builder']);

function currentRoute() {
  return window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard';
}

/* Error boundary around lazy pages so a failed chunk (or the not-yet-built
 * Builder.jsx) shows a friendly message instead of a white screen. */
class PageError extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="maintenance">
          <div className="box">
            <h2>একটি সমস্যা হয়েছে</h2>
            <p>পেজটি লোড করা যাচ্ছে না। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।</p>
            <button className="btn" onClick={() => window.location.reload()}>
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return <p style={{ padding: 24 }}>লোড হচ্ছে...</p>;
}

export default function App() {
  const [route, setRoute] = useState(currentRoute());
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  /* Seed demo data once on first boot; watch hash changes (also re-read auth). */
  useEffect(() => {
    try {
      seedIfNeeded();
    } catch (e) {
      /* ignore */
    }
    const h = () => {
      setRoute(currentRoute());
      setTick((t) => t + 1);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const auth = useMemo(() => {
    const builderSession = getSession('builder');
    const pharmacySession = getSession('pharmacy');
    const builderEnter =
      !!builderSession && sessionStorage.getItem(BUILDER_ENTER_KEY) === '1';
    return {
      builderSession,
      pharmacySession,
      builderEnter,
      setup: needsMasterSetup(),
      online: isSoftwareOnline(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const isBuilderMode = !!(auth.builderEnter && auth.builderSession);
  const user = isBuilderMode
    ? auth.builderSession.user
    : auth.pharmacySession
      ? auth.pharmacySession.user
      : null;

  /* Redirects: unknown routes -> dashboard; logged-in '#/login' -> dashboard;
   * role-restricted routes (users/settings) -> dashboard for non-masters. */
  useEffect(() => {
    if (!user) return;
    if (!KNOWN_ROUTES.has(route) || route === 'login') {
      window.location.hash = '#/dashboard';
      return;
    }
    if (!isBuilderMode) {
      const entry = NAV.find(([r]) => r === route);
      if (entry && entry[2] && user.role !== entry[2]) {
        window.location.hash = '#/dashboard';
      }
    }
  }, [route, user, isBuilderMode]);

  function handleLogout() {
    if (isBuilderMode) {
      sessionStorage.removeItem(BUILDER_ENTER_KEY);
      window.location.hash = '#/builder';
    } else {
      logout('pharmacy');
      window.location.hash = '#/login';
    }
    refresh();
  }

  /* 1. Builder portal (its own setup/login/panel, independent of pharmacy auth). */
  if (route === 'builder') {
    return (
      <Suspense fallback={<Loading />}>
        <PageError key={route}>
          <Builder />
        </PageError>
      </Suspense>
    );
  }

  /* 2. Builder-entered mode: valid builder session + enter flag. */
  if (isBuilderMode) {
    const Page = PAGES[route] || Dashboard;
    return (
      <Suspense fallback={<Loading />}>
        <PageError key={route}>
          <Layout user={user} route={route} onLogout={handleLogout} isBuilderMode>
            <Page user={user} isBuilderMode />
          </Layout>
        </PageError>
      </Suspense>
    );
  }

  /* 3. Pharmacy session: maintenance gate. */
  if (user && !auth.online) {
    return <Maintenance onRetry={refresh} />;
  }

  /* 4. First run: master admin setup. */
  if (!user && auth.setup) {
    return (
      <SetupMaster
        onDone={() => {
          refresh();
          window.location.hash = '#/dashboard';
        }}
      />
    );
  }

  /* 5. Not logged in: login screen. */
  if (!user) {
    return (
      <Login
        onDone={() => {
          refresh();
          window.location.hash = '#/dashboard';
        }}
      />
    );
  }

  /* 6. Logged in: app shell + lazy page. */
  const Page = PAGES[route] || Dashboard;
  return (
    <Suspense fallback={<Loading />}>
      <PageError key={route}>
        <Layout user={user} route={route} onLogout={handleLogout} isBuilderMode={false}>
          <Page user={user} />
        </Layout>
      </PageError>
    </Suspense>
  );
}
